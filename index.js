const express = require("express");
const { getBoardSummary } = require("./mondayClient");

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

    // Command: /mondaybot analyze <boardId>
    if (userText.startsWith("analyze")) {
        const parts = userText.split(/\s+/);
        const boardId = parseInt(parts[1], 10);

        if (isNaN(boardId)) {
            return res.json({
                response_type: "ephemeral",
                text: "Usage: `/mondaybot analyze <boardId>` (boardId must be a number).",
            });
        }

        try {
            const summary = await getBoardSummary(boardId);

            // If getBoardSummary returned a text property, it's an error/notice
            if (summary.text) {
                return res.json({
                    response_type: "ephemeral",
                    text: summary.text,
                });
            }

            const message =
                `📊 *Board:* ${summary.boardName} (ID: ${boardId})\n` +
                `• Total items: *${summary.totalItems}*\n\n` +
                `Here are a few example items:\n${summary.exampleItems}`;

            return res.json({
                response_type: "ephemeral",
                text: message,
            });
        } catch (err) {
            console.error("Error in analyze command:", err);
            return res.json({
                response_type: "ephemeral",
                text: "⚠️ There was an error talking to monday.com. Check the logs in Render.",
            });
        }
    }

    // Default: fallback echo
    return res.json({
        response_type: "ephemeral",
        text: `Got it, ${userName}. You said: "${userText}" 👌`,
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});