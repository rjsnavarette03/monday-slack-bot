// openaiClient.js
const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Ask OpenAI to answer a question using sheet data
async function answerFromSheet(question, sheetValues) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not set");
    }

    // Trim to last 50 rows to keep it fast and cheap
    const MAX_ROWS = 50;
    const trimmed = sheetValues.slice(-MAX_ROWS);

    const sheetJson = JSON.stringify(trimmed);

    // Compute "today" and "yesterday" so the model doesn't guess
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10); // e.g. 2025-12-11
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayIso = yesterday.toISOString().slice(0, 10); // e.g. 2025-12-10

    const systemPrompt = `
You are a data assistant answering questions from a Google Sheet.

CONTEXT ABOUT DATES:
- Today's date (according to the system) is ${todayIso}.
- "Yesterday" ALWAYS means ${yesterdayIso}, not the last row in the sheet.
- The first row of the sheet contains column headers.
- At least one column is a date column (often labeled "Date") and uses date-like values such as YYYY-MM-DD.

RULES:
1. When the user asks about "yesterday", you MUST:
   - Look for rows whose date column equals "${yesterdayIso}".
   - ONLY use those rows to answer a "yesterday" question.
2. If there is NO row for "${yesterdayIso}":
   - Clearly say there is no data for yesterday.
   - Then, if helpful, mention the LATEST date you do see in the sheet and its value.
   - Do NOT call that latest date "yesterday".
3. If the sheet appears to stop months before today, do NOT invent or assume data. Explain what the latest available data shows.
4. Use ONLY the sheet data to answer. If you can't find an exact match, explain the limitation instead of guessing.

Be concise and practical in your explanation.
`;

    const completion = await openai.chat.completions.create({
        model: "gpt-5.1", // or gpt-4.1-mini if you want cheaper
        messages: [
            {
                role: "developer",
                content: systemPrompt,
            },
            {
                role: "user",
                content:
                    `Here is the sheet data (JSON array of arrays, last ${MAX_ROWS} rows):\n\n${sheetJson}\n\nQuestion: ${question}`,
            },
        ],
    });

    return completion.choices[0].message.content;
}

module.exports = {
    answerFromSheet,
};