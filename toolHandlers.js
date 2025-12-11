const { findInDrive, readSheet, readDoc } = require("./driveTools");

async function handleToolCall(call) {
    const { name, arguments: args } = call;

    switch (name) {
        case "search_drive": {
            if (!args.query) {
                return { error: "Missing 'query' argument for search_drive." };
            }
            const result = await findInDrive(args.query);
            return result;
        }

        case "read_sheet": {
            if (!args.fileId) {
                return { error: "Missing 'fileId' for read_sheet." };
            }
            const result = await readSheet(args.fileId);
            return result;
        }

        case "read_doc": {
            if (!args.fileId) {
                return { error: "Missing 'fileId' for read_doc." };
            }
            const result = await readDoc(args.fileId);
            return result;
        }

        case "respond": {
            return { text: args.text || "" };
        }

        default:
            return { error: `Unknown tool: ${name}` };
    }
}

module.exports = { handleToolCall };