const OpenAI = require("openai");
const tools = require("./tools");

// OpenAI client
const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Automatic retry wrapper for 429s
async function callOpenAIWithRetry(payload, retries = 3) {
    try {
        return await client.chat.completions.create(payload);
    } catch (err) {
        if (err.status === 429 && retries > 0) {
            const wait = 500; // 0.5s
            console.warn(`⚠️ Rate limit hit. Retrying in ${wait}ms...`);
            await new Promise(r => setTimeout(r, wait));
            return callOpenAIWithRetry(payload, retries - 1);
        }
        throw err;
    }
}

const SYSTEM_PROMPT = `
You are a Slack AI assistant connected to Google Drive. 
You decide when to use tools.

TOOLS:
- search_drive(query)
- read_sheet(fileId)
- read_doc(fileId)
- respond(text)

RULES:
1. Use tools ONLY when user requests info from Google Drive, Docs, or Sheets.
2. For greetings or general chat ("hello", "thanks", "how are you", etc)
   → ALWAYS call respond().
3. NEVER guess any file content.
4. If a file is referenced, search for it first.
5. If multiple files match a search, ask the user which one.
6. Keep replies short and practical unless asked otherwise.

When search_drive is used, you will receive a list of files with:
- index
- id
- name
- mimeType

If the user replies with:
- a number ("1", "2", etc)
- a numbered choice ("1. MBO Leads...")
- the file name ("MBO Leads & Ads Spend")

THEN you MUST:
1. Match that selection to the corresponding file object from the last search results.
2. Use that file's id to call read_sheet or read_doc depending on mimeType.

NEVER guess file IDs. ALWAYS use the IDs returned by search_drive.
`;

// Run the agent with tool calling
async function runAgent(messages) {
    return callOpenAIWithRetry({
        model: "gpt-4.1-mini",     // ← Recommended for tool calling agents
        messages,
        tools,
        tool_choice: "auto"
    });
}

module.exports = {
    runAgent,
    SYSTEM_PROMPT
};