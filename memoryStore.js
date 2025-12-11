const memory = {};  // { userId: [messages] }
const lastSearchResults = {}; // { userId: [ { index, id, name, mimeType } ] }

function getHistory(userId) {
    if (!memory[userId]) memory[userId] = [];
    return memory[userId];
}

function appendToHistory(userId, message) {
    if (!memory[userId]) memory[userId] = [];
    memory[userId].push(message);

    // keep last 10 messages
    if (memory[userId].length > 10) {
        memory[userId] = memory[userId].slice(-10);
    }
}

function clearHistory(userId) {
    memory[userId] = [];
    lastSearchResults[userId] = [];
}

function setLastSearch(userId, files) {
    lastSearchResults[userId] = files || [];
}

function getLastSearch(userId) {
    return lastSearchResults[userId] || [];
}

module.exports = {
    getHistory,
    appendToHistory,
    clearHistory,
    setLastSearch,
    getLastSearch
};