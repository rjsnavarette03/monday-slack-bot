const OpenAI = require("openai");
const tools = require("./tools");

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `
You are an AI assistant connected to Google Drive, Google Sheets, and Google Docs.

You have these tools available:
- search_drive(query)
- read_sheet(fileId)
- read_doc(fileId)
- respond(text)

RULES:
1. If the user asks anything involving Drive, files, spreadsheets, or documents:
   - FIRST call search_drive.
   - If multiple results found, ask the user which one they meant.
   - If a spreadsheet, call read_sheet.
   - If a doc, call read_doc.
2. NEVER guess file contents — always use tools to fetch real data.
3. If the user references a file you previously opened, you may continue using it without searching again.
4. If the user asks a general question unrelated to Drive → call respond().
5. Always return valid JSON tool calls.
`;

async function runAgent(messages) {
    return client.chat.completions.create({
        model: "gpt-4.1",
        messages,
        tools,
        tool_choice: "auto"
    });
}

module.exports = {
    runAgent,
    SYSTEM_PROMPT
};