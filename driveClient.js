// driveClient.js
const { google } = require("googleapis");

async function getAuthClient() {
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!saJson) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
    }

    const credentials = JSON.parse(saJson);

    const scopes = [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/spreadsheets.readonly",
    ];

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes,
    });

    const client = await auth.getClient();
    return client;
}

// Search for a spreadsheet by its exact title (name)
async function findSpreadsheetByTitle(title) {
    const authClient = await getAuthClient();
    const drive = google.drive({ version: "v3", auth: authClient });

    const res = await drive.files.list({
        q: `name = '${title.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
        fields: "files(id, name)",
        spaces: "drive",
        pageSize: 5,
    });

    const files = res.data.files || [];
    if (!files.length) return null;
    // Just return the first match for now
    return files[0];
}

// Get all values from first sheet (you can refine later)
async function getSheetValues(spreadsheetId) {
    const authClient = await getAuthClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "A:Z", // You can tighten this to e.g. 'Sheet1!A:Z'
    });

    return res.data.values || [];
}

module.exports = {
    findSpreadsheetByTitle,
    getSheetValues,
};