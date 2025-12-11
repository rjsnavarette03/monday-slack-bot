module.exports = [
    {
        name: "search_drive",
        description: "Search Google Drive for files by name or keyword.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string" }
            },
            required: ["query"]
        }
    },
    {
        name: "read_sheet",
        description: "Read a Google Sheet document.",
        parameters: {
            type: "object",
            properties: {
                fileId: { type: "string" }
            },
            required: ["fileId"]
        }
    },
    {
        name: "read_doc",
        description: "Read a Google Docs file.",
        parameters: {
            type: "object",
            properties: {
                fileId: { type: "string" }
            },
            required: ["fileId"]
        }
    },
    {
        name: "respond",
        description: "Return a natural language reply.",
        parameters: {
            type: "object",
            properties: {
                text: { type: "string" }
            },
            required: ["text"]
        }
    }
];