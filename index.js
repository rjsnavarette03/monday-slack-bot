const express = require("express");
const axios = require("axios");
const { google } = require("googleapis");
const { runAgent, SYSTEM_PROMPT } = require("./aiAgent");
const { handleToolCall } = require("./toolHandlers");
const { getHistory, appendToHistory } = require("./memoryStore");
const { searchBoardsByName } = require("./mondayClient");

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

// Slack Events endpoint (for DMs / mentions)
app.post("/slack/events", async (req, res) => {
    const body = req.body;

    // 1) URL verification
    if (body.type === "url_verification") {
        return res.json({ challenge: body.challenge });
    }

    // 2) Event callbacks
    if (body.type === "event_callback") {
        const event = body.event;

        // Ignore bot messages (avoid loops)
        if (event.subtype === "bot_message") {
            return res.sendStatus(200);
        }

        // Ignore if the sender is the bot itself
        const botUserId = body.authorizations?.[0]?.user_id;
        if (event.user === botUserId) {
            return res.sendStatus(200);
        }

        const isDM = event.channel_type === "im";
        const isMention = event.type === "app_mention";

        if (!isDM && !isMention) {
            return res.sendStatus(200);
        }

        const userId = event.user;
        const channelId = event.channel;
        let text = event.text || "";

        // Remove the @mention from text (for channel messages)
        if (isMention) {
            const botUserId = body.authorizations?.[0]?.user_id;
            if (botUserId) {
                const mentionTag = `<@${botUserId}>`;
                text = text.replace(mentionTag, "").trim();
            }
        }

        // Acknowledge immediately to Slack
        res.sendStatus(200);

        // Now run the same agent logic you use for slash commands,
        // but reply with chat.postMessage instead of response_url.
        try {
            let history = getHistory(userId);
            appendToHistory(userId, { role: "user", content: text });

            let messages = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

            while (true) {
                const result = await runAgent(messages);
                const msg = result.choices[0].message;

                // If AI returns a final answer (no tools)
                if (!msg.tool_calls?.length) {
                    // unwrap JSON like {"text":"..."} if model uses respond tool
                    let finalContent = msg.content;
                    try {
                        const parsed = JSON.parse(finalContent);
                        if (parsed?.text) finalContent = parsed.text;
                    } catch (_) { }

                    appendToHistory(userId, { role: "assistant", content: finalContent });

                    await axios.post(
                        "https://slack.com/api/chat.postMessage",
                        {
                            channel: channelId,
                            text: finalContent,
                        },
                        {
                            headers: {
                                Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
                                "Content-Type": "application/json",
                            },
                        }
                    );

                    break;
                }

                // Handle board queries
                const toolCall = msg.tool_calls[0];
                const toolName = toolCall.function?.name;
                let args = {};
                try {
                    args = toolCall.function.arguments
                        ? JSON.parse(toolCall.function.arguments)
                        : {};
                } catch (_) { }

                // Fetch board data from Monday if requested
                if (toolName === "get_board_items") {
                    const boardName = args.boardName;
                    const boards = await searchBoardsByName(boardName);

                    if (boards.length === 0) {
                        await axios.post(
                            "https://slack.com/api/chat.postMessage",
                            {
                                channel: channelId,
                                text: `I couldn't find any board named "${boardName}" in your Monday.com account.`,
                            },
                            {
                                headers: {
                                    Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
                                    "Content-Type": "application/json",
                                },
                            }
                        );
                        break;
                    }

                    // If there's only one match, fetch its items
                    if (boards.length === 1) {
                        const boardId = boards[0].id;
                        const boardItems = await getBoardItems(boardId);
                        const itemNames = boardItems.items.map(item => item.name).join("\n");
                        messages.push({
                            role: "assistant",
                            tool_call_id: toolCall.id,
                            content: `Here are the items in your board:\n${itemNames}`,
                        });

                        await axios.post(
                            "https://slack.com/api/chat.postMessage",
                            {
                                channel: channelId,
                                text: `Here are the items in your board:\n${itemNames}`,
                            },
                            {
                                headers: {
                                    Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
                                    "Content-Type": "application/json",
                                },
                            }
                        );

                        break;
                    } else {
                        // If there are multiple matches, ask the user to choose
                        let reply = "I found multiple boards matching your request. Which one would you like?\n";
                        boards.forEach((board, index) => {
                            reply += `${index + 1}. ${board.name}\n`;
                        });

                        await axios.post(
                            "https://slack.com/api/chat.postMessage",
                            {
                                channel: channelId,
                                text: reply,
                            },
                            {
                                headers: {
                                    Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
                                    "Content-Type": "application/json",
                                },
                            }
                        );
                    }

                    break;
                }

                const toolOutput = await handleToolCall(
                    { name: toolName, arguments: args },
                    userId
                );

                messages.push({
                    role: "assistant",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(toolOutput),
                });

                appendToHistory(userId, {
                    role: "assistant",
                    content: `Used tool: ${toolName}.`,
                });
            }
        } catch (err) {
            console.error("Agent error:", err);

            await axios.post(
                "https://slack.com/api/chat.postMessage",
                {
                    channel: channelId,
                    text: "❌ Error: " + err.message,
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        return;
    }

    // Fallback
    res.sendStatus(200);
});

// Health check
app.get("/", (req, res) => {
    res.send("Slack → Render backend is running ✅");
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});