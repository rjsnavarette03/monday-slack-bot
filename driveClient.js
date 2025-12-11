// driveClient.js
const { google } = require("googleapis");

function getAuthClient() {
    const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!saJson) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
    }

    const credentials = JSON.parse(saJson);

    const scopes = [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/spreadsheets.readonly",
    ];

    const auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        scopes
    );

    return auth;
}

// Search for a spreadsheet by its exact title (name)
async function findSpreadsheetByTitle(title) {
    const auth = getAuthClient();
    const drive = google.drive({ version: "v3", auth });

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
    const auth = getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });

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