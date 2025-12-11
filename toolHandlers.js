// toolHandlers.js
const { findInDrive, readSheet, readDoc } = require("./driveTools");
const { setLastSearch, getLastSearch } = require("./memoryStore");

async function handleToolCall(call, userId) {
    const { name, arguments: args } = call;

    switch (name) {
        case "search_drive": {
            if (!args.query) {
                return { error: "Missing 'query' argument for search_drive." };
            }

            const result = await findInDrive(args.query);
            // Store these results for this user
            setLastSearch(userId, result.files);

            return result;
        }

        case "read_sheet": {
            const files = getLastSearch(userId);
            const idx = args.index;

            if (!idx || !Number.isInteger(idx)) {
                return { error: "read_sheet requires an integer 'index'." };
            }

            const file = files.find(f => f.index === idx);
            if (!file) {
                return { error: `No file found at index ${idx} from the last search.` };
            }

            // Optional: extra safety log
            console.log("read_sheet using file:", file);

            const result = await readSheet(file.id);
            return result;
        }

        case "read_doc": {
            const files = getLastSearch(userId);
            const idx = args.index;

            if (!idx || !Number.isInteger(idx)) {
                return { error: "read_doc requires an integer 'index'." };
            }

            const file = files.find(f => f.index === idx);
            if (!file) {
                return { error: `No file found at index ${idx} from the last search.` };
            }

            console.log("read_doc using file:", file);

            const result = await readDoc(file.id);
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