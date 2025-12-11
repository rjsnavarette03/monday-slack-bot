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

    // Avoid Slack timeout
    res.json({
        response_type: "ephemeral",
        text: "🤖 Working on it..."
    });

    try {
        // Get user conversation memory
        let history = getHistory(userId);

        // Add user message
        appendToHistory(userId, { role: "user", content: userText });

        // Build message list (system + memory)
        let messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...history
        ];

        while (true) {
            const result = await runAgent(messages);
            const msg = result.choices[0].message;

            // If AI returns a final answer (no tools)
            if (!msg.tool_calls?.length) {
                appendToHistory(userId, { role: "assistant", content: msg.content });

                await axios.post(responseUrl, {
                    response_type: "ephemeral",
                    text: msg.content
                });
                break;
            }

            // Handle first tool call
            const toolCall = msg.tool_calls[0];
            const toolOutput = await handleToolCall(toolCall);

            // Append tool result
            messages.push({
                role: "assistant",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolOutput)
            });

            // Add to conversation memory
            appendToHistory(userId, {
                role: "assistant",
                content: `[tool:${toolCall.function.name}] ${JSON.stringify(toolOutput)}`
            });
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