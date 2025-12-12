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

// Function to search boards by name
async function searchBoardsByName(boardName) {
	const query = `
    query {
      boards (limit: 50) {
        id
        name
      }
    }
  `;

	const result = await makeMondayApiRequest(query);
	if (!result) return null;

	// Filter boards by name
	const matchingBoards = result.boards.filter(board =>
		board.name.toLowerCase().includes(boardName.toLowerCase())
	);

	return matchingBoards;
}

module.exports = { searchBoardsByName };