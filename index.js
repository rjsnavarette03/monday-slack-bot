const express = require("express");
const axios = require("axios");
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
                appendToHistory(userId, { role: "assistant", content: msg.content });

                await axios.post(responseUrl, {
                    response_type: "ephemeral",
                    text: msg.content
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
                content: `[tool:${toolName}] ${JSON.stringify(toolResult)}`
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