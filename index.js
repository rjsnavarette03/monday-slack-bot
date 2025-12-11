const express = require("express");
const axios = require("axios");
const { getBoardSummary } = require("./mondayClient");
const { findSpreadsheetByTitle, getSheetValues } = require("./driveClient");
const { answerFromSheet } = require("./openaiClient");

const app = express();
const PORT = process.env.PORT || 3000;

// Slack sends slash commands as x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Health check
app.get("/", (req, res) => {
    res.send("Slack → Render backend is running ✅");
});

// Slash command handler
app.post("/slack/command", (req, res) => {
    console.log("Slash command payload:", req.body);

    const userText = (req.body.text || "").trim();
    const userName = req.body.user_name || "there";
    const responseUrl = req.body.response_url;

    // 1) Monday analyze command - placeholder for now
    if (userText.startsWith("analyze")) {
        return res.json({
            response_type: "ephemeral",
            text: "Analyze command is currently disabled until Monday API is ready.",
        });
    }

    // 2) Google Drive + OpenAI flow
    const titleMatch = userText.match(/spreadsheet titled '([^']+)'/i);
    if (titleMatch) {
        const sheetTitle = titleMatch[1];

        // Immediately acknowledge to avoid Slack timeout
        res.json({
            response_type: "ephemeral",
            text: `🔍 Got it, ${userName}. I'm looking in the spreadsheet titled '${sheetTitle}' and will post the answer here shortly...`,
        });

        // Do the heavy work asynchronously
        (async () => {
            try {
                // a) Find the spreadsheet
                const file = await findSpreadsheetByTitle(sheetTitle);
                if (!file) {
                    await axios.post(responseUrl, {
                        response_type: "ephemeral",
                        text: `❌ I couldn't find a spreadsheet in Drive titled '${sheetTitle}'. Make sure it exists and is shared with the service account.`,
                    });
                    return;
                }

                // b) Get sheet values
                const values = await getSheetValues(file.id);
                if (!values.length) {
                    await axios.post(responseUrl, {
                        response_type: "ephemeral",
                        text: `I found '${file.name}' but it appears to be empty or has no data.`,
                    });
                    return;
                }

                // c) Ask OpenAI to answer based on the sheet + original question
                const aiAnswer = await answerFromSheet(userText, values);

                const message =
                    `📄 *Sheet:* ${file.name}\n` +
                    `Here’s what I found based on your question:\n\n` +
                    aiAnswer;

                await axios.post(responseUrl, {
                    response_type: "ephemeral",
                    text: message,
                });
            } catch (err) {
                console.error("Error handling Drive/OpenAI question:", err);
                await axios.post(responseUrl, {
                    response_type: "ephemeral",
                    text:
                        "⚠️ Something went wrong while talking to Google Drive or OpenAI. Check the logs in Render.",
                });
            }
        })();

        // Important: return here so we don't fall through
        return;
    }

    // 3) Fallback: simple echo
    return res.json({
        response_type: "ephemeral",
        text: `Got it, ${userName}. You said: "${userText}" 👌`,
    });
});

// Test Google Auth endpoint
app.get("/test-google", async (req, res) => {
    try {
        const { google } = require("googleapis");

        const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (!raw) {
            return res.status(500).send("GOOGLE_SERVICE_ACCOUNT_JSON is NOT set.");
        }

        let creds;
        try {
            creds = JSON.parse(raw);
        } catch (e) {
            console.error("JSON parse error:", e);
            return res
                .status(500)
                .send("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON as JSON.");
        }

        const keys = Object.keys(creds);
        const hasPrivateKey =
            typeof creds.private_key === "string" && creds.private_key.length > 0;
        const hasClientEmail =
            typeof creds.client_email === "string" && creds.client_email.length > 0;

        console.log("Service account keys present:", keys);
        console.log("Has private_key?", hasPrivateKey);
        console.log("Has client_email?", hasClientEmail);

        if (!hasPrivateKey) {
            return res
                .status(500)
                .send(
                    "Parsed JSON but it does NOT contain a valid private_key field."
                );
        }

        const scopes = [
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/spreadsheets.readonly",
        ];

        // ✅ Use GoogleAuth instead of JWT directly
        const auth = new google.auth.GoogleAuth({
            credentials: creds,
            scopes,
        });

        const client = await auth.getClient();
        // Just to confirm it really works, make a simple Drive call:
        const drive = google.drive({ version: "v3", auth: client });

        // List 1 file (if accessible)
        const resp = await drive.files.list({
            pageSize: 1,
            fields: "files(id, name)",
        });

        console.log("Sample Drive list result:", resp.data.files);

        return res.send("Google Auth SUCCESS! I can talk to Drive ✅");
    } catch (err) {
        console.error(err);
        return res.send("Google Auth FAILED: " + err.message);
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});