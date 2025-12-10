const express = require("express");

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

    const userText = req.body.text || "";
    const userName = req.body.user_name || "there";

    return res.json({
        response_type: "ephemeral", // only visible to the user who called the command
        text: `Got it, ${userName}. You said: "${userText}" 👌`,
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});