const express = require("express");
const axios = require("axios");
const { getBoardSummary } = require("./mondayClient");
const { findSpreadsheetByTitle, getSheetValues } = require("./driveClient");
const { summarizeAdSpendFromSheet } = require("./sheetAnalytics");
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

    // 1) Monday analyze command - still placeholder
    if (userText.startsWith("analyze")) {
        return res.json({
            response_type: "ephemeral",
            text: "Analyze command is currently disabled until Monday API is ready.",
        });
    }

    // 2) Google Drive flow for spreadsheets
    const titleMatch = userText.match(/spreadsheet titled '([^']+)'/i);
    if (titleMatch) {
        const sheetTitle = titleMatch[1];

        // Fast ack to Slack
        res.json({
            response_type: "ephemeral",
            text: `🔍 Got it, ${userName}. I'm looking in the spreadsheet titled '${sheetTitle}' and will post the answer here shortly...`,
        });

        (async () => {
            try {
                // Find spreadsheet
                const file = await findSpreadsheetByTitle(sheetTitle);
                if (!file) {
                    await axios.post(responseUrl, {
                        response_type: "ephemeral",
                        text: `❌ I couldn't find a spreadsheet in Drive titled '${sheetTitle}'. Make sure it exists and is shared with the service account.`,
                    });
                    return;
                }

                const values = await getSheetValues(file.id);
                if (!values || !values.length) {
                    await axios.post(responseUrl, {
                        response_type: "ephemeral",
                        text: `I found '${file.name}' but it appears to be empty or has no data.`,
                    });
                    return;
                }

                // If the question mentions "spend" we’ll run our numeric logic
                if (userText.toLowerCase().includes("spend")) {
                    const summary = summarizeAdSpendFromSheet(userText, values);

                    if (!summary.ok) {
                        await axios.post(responseUrl, {
                            response_type: "ephemeral",
                            text: `📄 *Sheet:* ${file.name}\n${summary.message}`,
                        });
                        return;
                    }

                    const { label, range, latestInRange, latestOverall, hasDataInRange, total, days } =
                        summary;

                    const rangeStr = `${range.start.toISOString().slice(0, 10)} to ${range.end
                        .toISOString()
                        .slice(0, 10)}`;

                    let text;

                    if (hasDataInRange) {
                        if (label === "yesterday") {
                            text =
                                `📄 *Sheet:* ${file.name}\n` +
                                `For *yesterday* (${range.start.toISOString().slice(0, 10)}), total ad spend was *$${total.toFixed(
                                    2
                                )}*.\n` +
                                `Latest row in that range is ${latestInRange.dateStr} with spend *$${latestInRange.value.toFixed(
                                    2
                                )}*.`;
                        } else {
                            text =
                                `📄 *Sheet:* ${file.name}\n` +
                                `For *${label}* (${rangeStr}), total ad spend was *$${total.toFixed(
                                    2
                                )}* across *${days}* day(s).\n` +
                                `Most recent date in that range is ${latestInRange.dateStr} with spend *$${latestInRange.value.toFixed(
                                    2
                                )}*.`;
                        }
                    } else {
                        text =
                            `📄 *Sheet:* ${file.name}\n` +
                            `I couldn't find any ad spend data for *${label}* (${rangeStr}).\n` +
                            (latestOverall
                                ? `The latest available data in the sheet is ${latestOverall.dateStr} with spend *$${latestOverall.value?.toFixed(
                                    2
                                ) || "N/A"}*.`
                                : "I couldn't find any valid ad spend data at all.");
                    }

                    await axios.post(responseUrl, {
                        response_type: "ephemeral",
                        text,
                    });
                    return;
                }

                // If it's not a "spend" question, you can still fall back to OpenAI or a generic summary here.
                await axios.post(responseUrl, {
                    response_type: "ephemeral",
                    text:
                        `📄 *Sheet:* ${file.name}\n` +
                        `I can see ${values.length - 1} data row(s). Right now I'm optimized for questions about ad spend (yesterday, last 7 days, last month).`,
                });
            } catch (err) {
                console.error("Error handling Drive question:", err);
                await axios.post(responseUrl, {
                    response_type: "ephemeral",
                    text:
                        "⚠️ Something went wrong while talking to Google Drive. Check the logs in Render.",
                });
            }
        })();

        return;
    }

    // 3) Fallback: echo
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