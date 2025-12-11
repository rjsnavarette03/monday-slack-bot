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

    const completion = await openai.chat.completions.create({
        model: "gpt-5.1", // or gpt-4.1-mini if you want cheaper
        messages: [
            {
                role: "developer",
                content:
                    "You are a data assistant. You are given a Google Sheet as an array of rows. The first row contains column headers. Use ONLY the data in the sheet to answer the user's question. If something is unclear or missing, explain that clearly. Be concise and practical.",
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