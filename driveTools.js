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

async function resolveFile(fileId) {
    const auth = await getClient();
    const drive = google.drive({ version: "v3", auth });

    const res = await drive.files.get({
        fileId,
        fields: "id, name, mimeType, shortcutDetails",
    });

    const file = res.data;

    // If it's a shortcut, use the target
    if (file.mimeType === "application/vnd.google-apps.shortcut") {
        const target = file.shortcutDetails?.targetId;
        const targetMimeType = file.shortcutDetails?.targetMimeType;

        console.log(
            `Resolving shortcut: ${file.name} (${file.id}) -> target ${target} (${targetMimeType})`
        );

        return {
            id: target,
            name: file.name,
            mimeType: targetMimeType,
            isShortcut: true,
        };
    }

    return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        isShortcut: false,
    };
}

/*** SEARCH DRIVE ***/
async function findInDrive(query) {
    const auth = await getClient();
    const drive = google.drive({ version: "v3", auth });

    const res = await drive.files.list({
        q: `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
        fields: "files(id, name, mimeType)",
        pageSize: 20,
    });

    const files = (res.data.files || []).map((f, index) => ({
        index: index + 1,
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
    }));

    console.log("search_drive results:", files);

    return { files };
}

/*** READ SHEET ***/
async function readSheet(fileId) {
    // Resolve shortcuts + get mimeType
    const resolved = await resolveFile(fileId);

    console.log("readSheet resolved file:", resolved);

    if (resolved.mimeType !== "application/vnd.google-apps.spreadsheet") {
        throw new Error(
            `File "${resolved.name}" is not a Google Sheet (mimeType=${resolved.mimeType}).`
        );
    }

    const auth = await getClient();
    const sheets = google.sheets({ version: "v4", auth });

    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: resolved.id,
            range: "A:Z",
        });

        return {
            values: res.data.values,
            file: resolved,
        };
    } catch (err) {
        console.error("Sheets API error for spreadsheetId:", resolved.id, err);
        throw err;
    }
}

/*** READ DOC ***/
async function readDoc(fileId) {
    const resolved = await resolveFile(fileId);

    console.log("readDoc resolved file:", resolved);

    if (resolved.mimeType !== "application/vnd.google-apps.document") {
        throw new Error(
            `File "${resolved.name}" is not a Google Doc (mimeType=${resolved.mimeType}).`
        );
    }

    const auth = await getClient();
    const docs = google.docs({ version: "v1", auth });

    const result = await docs.documents.get({
        documentId: resolved.id,
    });

    const text = result.data.body.content
        .map(
            (el) =>
                el.paragraph?.elements
                    ?.map((e) => e.textRun?.content || "")
                    .join("") || ""
        )
        .join("\n");

    return { text, file: resolved };
}

module.exports = { findInDrive, readSheet, readDoc };