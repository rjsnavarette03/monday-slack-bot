const express = require("express");
const axios = require("axios");
const { getBoardSummary } = require("./mondayClient");
const { findSpreadsheetByTitle, getSheetValues } = require("./driveClient");
const { summarizeAdSpendFromSheet } = require("./sheetAnalytics");
const { answerFromSheet } = require("./openaiClient");
const { runAgent, SYSTEM_PROMPT } = require("./aiAgent");
const { handleToolCall } = require("./toolHandlers");
const { getHistory, appendToHistory } = require("./memoryStore");

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
    const userText = req.body.text || "";
    const userId = req.body.user_id;
    const responseUrl = req.body.response_url;

    // Prevent Slack timeout
    res.json({ response_type: "ephemeral", text: "🤖 Working on it..." });

    try {
        // Retrieve conversation history
        const history = getHistory(userId);

        // Add user message
        history.push({ role: "user", content: userText });

        // Build message array
        let messages = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

        while (true) {
            const result = await runAgent(messages);
            const msg = result.choices[0].message;

            // If no tool call — final answer
            if (!msg.tool_calls?.length) {
                history.push({ role: "assistant", content: msg.content });

                await axios.post(responseUrl, {
                    response_type: "ephemeral",
                    text: msg.content
                });

                break;
            }

            // Handle tool call
            const toolCall = msg.tool_calls[0];
            const toolResult = await handleToolCall(toolCall);

            // Push tool result
            messages.push({
                role: "assistant",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult)
            });
        }
    } catch (err) {
        await axios.post(responseUrl, {
            response_type: "ephemeral",
            text: "❌ Error: " + err.message
        });
    }
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