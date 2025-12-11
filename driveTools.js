const { google } = require("googleapis");

function getClient() {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: [
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/documents.readonly",
            "https://www.googleapis.com/auth/spreadsheets.readonly",
        ]
    });
    return auth.getClient();
}

async function findInDrive(query) {
    const auth = await getClient();
    const drive = google.drive({ version: "v3", auth });

    const res = await drive.files.list({
        q: `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
        fields: "files(id, name, mimeType)"
    });

    return { files: res.data.files };
}

async function readSheet(fileId) {
    const auth = await getClient();
    const sheets = google.sheets({ version: "v4", auth });

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: fileId,
        range: "A:Z"
    });

    return { values: res.data.values };
}

async function readDoc(fileId) {
    const auth = await getClient();
    const docs = google.docs({ version: "v1", auth });

    const result = await docs.documents.get({ documentId: fileId });

    const text = result.data.body.content
        .map(el => el.paragraph?.elements?.map(e => e.textRun?.content || "").join("") || "")
        .join("\n");

    return { text };
}

module.exports = { findInDrive, readSheet, readDoc };