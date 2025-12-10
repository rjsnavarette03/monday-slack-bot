// mondayClient.js
const axios = require("axios");

const MONDAY_API_URL = "https://api.monday.com/v2";

async function queryMonday(query, variables = {}) {
    const apiKey = process.env.MONDAY_API_KEY;
    if (!apiKey) {
        throw new Error("MONDAY_API_KEY is not set");
    }

    const res = await axios.post(
        MONDAY_API_URL,
        { query, variables },
        {
            headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
            },
        }
    );

    if (res.data.errors) {
        console.error("Monday API errors:", res.data.errors);
        throw new Error("Error from monday.com API");
    }

    return res.data.data;
}

// Get a simple summary of a board: name, number of items, a few examples
async function getBoardSummary(boardId) {
    const query = `
    query ($boardId: [Int]) {
      boards (ids: $boardId) {
        id
        name
        items_page(limit: 50) {
          items {
            id
            name
            column_values {
              id
              text
            }
          }
        }
      }
    }
  `;

    const data = await queryMonday(query, { boardId });

    const board = data.boards && data.boards[0];
    if (!board) {
        return { text: `❌ No board found with ID ${boardId}.` };
    }

    const items = (board.items_page && board.items_page.items) || [];
    const totalItems = items.length;

    const exampleItems =
        items
            .slice(0, 5)
            .map((item) => `• ${item.name} (ID: ${item.id})`)
            .join("\n") || "No items found on this board.";

    return {
        boardName: board.name,
        totalItems,
        exampleItems,
    };
}

module.exports = { getBoardSummary };