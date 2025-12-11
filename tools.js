module.exports = [
    {
        type: "function",
        function: {
            name: "search_drive",
            description: "Search Google Drive for files by name or keyword.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string" }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "read_sheet",
            description: "Read a Google Sheets document and return cell values.",
            parameters: {
                type: "object",
                properties: {
                    fileId: { type: "string" }
                },
                required: ["fileId"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "read_doc",
            description: "Read a Google Docs document and return text.",
            parameters: {
                type: "object",
                properties: {
                    fileId: { type: "string" }
                },
                required: ["fileId"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "respond",
            description: "Respond with natural language when no tools are needed.",
            parameters: {
                type: "object",
                properties: {
                    text: { type: "string" }
                },
                required: ["text"]
            }
        }
    }
];