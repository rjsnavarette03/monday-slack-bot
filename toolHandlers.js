const { findInDrive, readSheet, readDoc } = require("./driveTools");
const { setLastSearch } = require("./memoryStore");

async function handleToolCall(call, userId) {
    const { name, arguments: args } = call;

    switch (name) {
        case "search_drive": {
            const result = await findInDrive(args.query);
            setLastSearch(userId, result.files);
            return result;
        }
        case "read_sheet":
            return await readSheet(args.fileId);
        case "read_doc":
            return await readDoc(args.fileId);
        case "respond":
            return { text: args.text };
        default:
            return { error: `Unknown tool: ${name}` };
    }
}

module.exports = { handleToolCall };