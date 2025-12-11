const memory = {};  // { userId: [messages] }

// Return last 10 messages only
function getHistory(userId) {
    if (!memory[userId]) memory[userId] = [];
    return memory[userId];
}

function appendToHistory(userId, message) {
    if (!memory[userId]) memory[userId] = [];
    memory[userId].push(message);

    // Prevent overflow
    if (memory[userId].length > 10) {
        memory[userId] = memory[userId].slice(-10);
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