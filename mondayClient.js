// mondayClient.js
const axios = require('axios');

// Set up the Monday API endpoint and token
const MONDAY_API_URL = 'https://api.monday.com/v2/';
const MONDAY_API_KEY = process.env.MONDAY_API_KEY;

// Function to make the API request
async function makeMondayApiRequest(query) {
	try {
		const response = await axios.post(
			MONDAY_API_URL,
			{ query },
			{
				headers: {
					'Authorization': MONDAY_API_KEY,
					'Content-Type': 'application/json',
				},
			}
		);
		return response.data.data;
	} catch (error) {
		console.error('Error making Monday API request:', error);
		return null;
	}
}

// Function to fetch board details
async function getBoardDetails(boardId) {
	const query = `
    query {
      boards(ids: [${boardId}]) {
        name
        columns {
          title
          id
        }
        items {
          id
          name
          column_values {
            text
            title
          }
        }
      }
    }
  `;
	return await makeMondayApiRequest(query);
}

// Example: Fetch all tasks from a board
async function getBoardItems(boardId) {
	const query = `
    query {
      boards(ids: [${boardId}]) {
        items {
          id
          name
        }
      }
    }
  `;
	return await makeMondayApiRequest(query);
}

module.exports = { getBoardDetails, getBoardItems };