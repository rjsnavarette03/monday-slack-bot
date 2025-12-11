const express = require("express");
const axios = require("axios");
const { google } = require("googleapis");
const { runAgent, SYSTEM_PROMPT } = require("./aiAgent");
const { handleToolCall } = require("./toolHandlers");
const { getHistory, appendToHistory } = require("./memoryStore");

const app = express();
const PORT = process.env.PORT || 3000;

// Slack sends slash commands as x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function getOAuth2Client() {
    const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
    return client;
}

// Step 1: Start OAuth flow
app.get("/auth/google", (req, res) => {
    const oauth2Client = getOAuth2Client();

    const scopes = [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/documents.readonly"
    ];

    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",  // needed for refresh_token
        prompt: "consent",       // force showing consent screen to ensure refresh_token
        scope: scopes
    });

    res.redirect(url);
});

// Step 2: OAuth callback (Google redirects here)
app.get("/auth/google/callback", async (req, res) => {
    const code = req.query.code;
    const oauth2Client = getOAuth2Client();

    try {
        const { tokens } = await oauth2Client.getToken(code);

        console.log("🔑 Google OAuth tokens received:", tokens);

        // IMPORTANT: refresh_token will be here the first time you consent.
        if (tokens.refresh_token) {
            console.log("✅ SAVE THIS REFRESH TOKEN IN RENDER ENV AS GOOGLE_REFRESH_TOKEN:");
            console.log(tokens.refresh_token);
        } else {
            console.log("⚠️ No refresh_token returned. You may need to revoke access and try again with prompt=consent.");
        }

        res.send("Auth successful! Check your server logs for the refresh_token. You can close this page.");
    } catch (err) {
        console.error("Error during Google OAuth callback:", err);
        res.status(500).send("Google OAuth error: " + err.message);
    }
});

// Health check
app.get("/", (req, res) => {
    res.send("Slack → Render backend is running ✅");
});

// Slash command handler
app.post("/slack/command", async (req, res) => {
    const userText = req.body.text || "";
    const userId = req.body.user_id;
    const responseUrl = req.body.response_url;

    // Prevent Slack request timeout
    res.json({
        response_type: "ephemeral",
        text: "🤖 Working on it..."
    });

    try {
        // Load user conversation memory
        let history = getHistory(userId);

        // Record new user message
        appendToHistory(userId, { role: "user", content: userText });

        // Build messages array for OpenAI
        let messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...history
        ];

        while (true) {
            const result = await runAgent(messages);
            const msg = result.choices[0].message;

            // CASE 1 — No tools requested → final answer
            if (!msg.tool_calls?.length) {

                // Clean up JSON-like assistant messages
                let finalContent = msg.content;

                try {
                    const parsed = JSON.parse(finalContent);
                    if (parsed?.text) {
                        finalContent = parsed.text;
                    }
                } catch (_) {
                    // It's fine — message was not JSON
                }

                // Store ONLY natural language responses in memory
                appendToHistory(userId, { role: "assistant", content: finalContent });

                await axios.post(responseUrl, {
                    response_type: "ephemeral",
                    text: finalContent
                });

                break;
            }

            // CASE 2 — Tool call received
            const toolCall = msg.tool_calls[0];

            // Extract tool name
            const toolName = toolCall.function?.name;

            if (!toolName) {
                console.error("❌ Tool call missing function.name:", toolCall);

                await axios.post(responseUrl, {
                    response_type: "ephemeral",
                    text: "❌ AI attempted a tool call but did not specify a tool name."
                });

                break;
            }

            // Extract & parse arguments
            let args = {};
            try {
                args = toolCall.function.arguments
                    ? JSON.parse(toolCall.function.arguments)
                    : {};
            } catch (err) {
                console.error("❌ Failed to parse tool arguments:", toolCall.function.arguments);
            }

            // Execute the tool
            const toolResult = await handleToolCall({
                name: toolName,
                arguments: args
            });

            // Add tool result into next OpenAI call
            messages.push({
                role: "assistant",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult)
            });

            // Add to memory
            appendToHistory(userId, {
                role: "assistant",
                content: `Used tool: ${toolName}.`
            });

            // And loop again (OpenAI may call another tool)
        }

    } catch (err) {
        console.error("Agent error:", err);

        await axios.post(responseUrl, {
            response_type: "ephemeral",
            text: "❌ Error: " + err.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});