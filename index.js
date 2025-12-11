const express = require("express");
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
app.post("/slack/command", async (req, res) => {
    console.log("Slash command payload:", req.body);

    const userText = (req.body.text || "").trim();
    const userName = req.body.user_name || "there";

    // 1) If it's your old monday.com 'analyze' command, keep behavior as-is
    if (userText.startsWith("analyze")) {
        // existing monday logic here if you still want it
        return res.json({
            response_type: "ephemeral",
            text: "Analyze command is currently disabled until Monday API is ready.",
        });
    }

    // 2) New: Google Drive + OpenAI flow
    // Expect something like: "In the spreadsheet titled 'MBO Leads & Ads Spend', what's yesterday ads spend?"
    const titleMatch = userText.match(/spreadsheet titled '([^']+)'/i);
    if (titleMatch) {
        const sheetTitle = titleMatch[1];

        try {
            // a) Find the spreadsheet
            const file = await findSpreadsheetByTitle(sheetTitle);
            if (!file) {
                return res.json({
                    response_type: "ephemeral",
                    text: `❌ I couldn't find a spreadsheet in your Drive titled '${sheetTitle}'. Make sure it exists and is shared with the service account.`,
                });
            }

            // b) Get sheet values
            const values = await getSheetValues(file.id);

            if (!values.length) {
                return res.json({
                    response_type: "ephemeral",
                    text: `I found '${file.name}' but it appears to be empty or has no data.`,
                });
            }

            // c) Ask OpenAI to answer based on the sheet + original question
            const aiAnswer = await answerFromSheet(userText, values);

            return res.json({
                response_type: "ephemeral",
                text:
                    `📄 *Sheet:* ${file.name}\n` +
                    `Here’s what I found:\n\n` +
                    aiAnswer,
            });
        } catch (err) {
            console.error("Error handling Drive/OpenAI question:", err);
            return res.json({
                response_type: "ephemeral",
                text:
                    "⚠️ Something went wrong while talking to Google Drive or OpenAI. Check the logs in Render.",
            });
        }
    }

    // 3) Fallback: simple echo
    return res.json({
        response_type: "ephemeral",
        text: `Got it, ${userName}. You said: "${userText}" 👌`,
    });
});

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