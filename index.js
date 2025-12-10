const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const app = express();
app.use(express.urlencoded({ extended: true })); // for Slack slash commands
app.use(express.json()); // for JSON events if you use them later

const PORT = process.env.PORT || 3000;

// Verify Slack signature (for security)
function verifySlackRequest(req, res, buf) {
    const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
    const timestamp = req.headers["x-slack-request-timestamp"];
    const signature = req.headers["x-slack-signature"];

    if (!slackSigningSecret || !timestamp || !signature) return false;

    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
    if (timestamp < fiveMinutesAgo) {
        return false;
    }

    const sigBasestring = `v0:${timestamp}:${buf.toString()}`;
    const mySig =
        "v0=" +
        crypto
            .createHmac("sha256", slackSigningSecret)
            .update(sigBasestring, "utf8")
            .digest("hex");

    return crypto.timingSafeEqual(Buffer.from(mySig, "utf8"), Buffer.from(signature, "utf8"));
}

// Middleware to grab raw body for verification
app.use((req, res, next) => {
    let data = [];
    req.on("data", (chunk) => data.push(chunk));
    req.on("end", () => {
        req.rawBody = Buffer.concat(data);
        next();
    });
});

// Simple slash command endpoint
app.post("/slack/command", async (req, res) => {
    // Verify Slack request
    if (!verifySlackRequest(req, res, req.rawBody)) {
        return res.status(400).send("Invalid request signature");
    }

    const { text, user_name } = req.body;

    // For now, just respond something simple
    if (text === "ping") {
        return res.json({ text: `Pong, ${user_name}! 🎯` });
    }

    // Later: call monday + OpenAI based on text
    return res.json({
        text: `You said: "${text}". I'll eventually analyze your monday board based on this.`
    });
});

app.get("/", (req, res) => {
    res.send("Slack → Monday → OpenAI bot backend is running.");
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
