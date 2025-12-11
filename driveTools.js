const { google } = require("googleapis");

function getOAuth2Client() {
    const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    return client;
}

async function getClient() {
    const oauth2Client = getOAuth2Client();
    // googleapis will automatically use the refresh_token to get access tokens
    return oauth2Client;
}

/*** SEARCH DRIVE ***/
async function findInDrive(query) {
    const auth = await getClient();
    const drive = google.drive({ version: "v3", auth });

    const res = await drive.files.list({
        q: `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
        fields: "files(id, name, mimeType)",
        pageSize: 10,
    });

    return {
        files: res.data.files.map((f, index) => ({
            index: index + 1,
            id: f.id,
            name: f.name,
            mimeType: f.mimeType
        }))
    };
}

/*** READ SHEET ***/
async function readSheet(fileId) {
    const auth = await getClient();
    const sheets = google.sheets({ version: "v4", auth });

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: fileId,
        range: "A:Z",
    });

    return { values: res.data.values };
}

/*** READ DOC ***/
async function readDoc(fileId) {
    const auth = await getClient();
    const docs = google.docs({ version: "v1", auth });

    const result = await docs.documents.get({
        documentId: fileId,
    });

    const text = result.data.body.content
        .map((el) =>
            el.paragraph?.elements
                ?.map((e) => e.textRun?.content || "")
                .join("") || ""
        )
        .join("\n");

    return { text };
}

module.exports = { findInDrive, readSheet, readDoc };