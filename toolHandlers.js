const { findInDrive, readSheet, readDoc } = require("./driveTools");

async function handleToolCall(call) {
    const { name, arguments: args } = call;

    switch (name) {
        case "search_drive":
            return await findInDrive(args.query);

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