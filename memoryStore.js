// Simple in-memory memory storage (per Slack user)
// Later you can upgrade this to Redis or DB for persistence.

const memory = {};  // { userId: [messages] }

function getHistory(userId) {
    if (!memory[userId]) {
        memory[userId] = [];
    }
    return memory[userId];
}

function appendToHistory(userId, message) {
    if (!memory[userId]) memory[userId] = [];
    memory[userId].push(message);

    // Limit history to last 25 messages so memory doesn't explode
    if (memory[userId].length > 25) {
        memory[userId].shift();
    }
}

function clearHistory(userId) {
    memory[userId] = [];
}

module.exports = {
    getHistory,
    appendToHistory,
    clearHistory
};