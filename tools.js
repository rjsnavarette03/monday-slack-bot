// tools.js
module.exports = [
    {
        type: "function",
        function: {
            name: "search_drive",
            description: "Search Google Drive for files by name or keyword.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search term or filename" }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "read_sheet",
            description:
                "Read a Google Sheets file that was returned from the most recent search_drive call. Select it by its numbered index from that list.",
            parameters: {
                type: "object",
                properties: {
                    index: {
                        type: "integer",
                        description:
                            "1-based index of the file from the last search_drive result (e.g. 1 for the first file)."
                    }
                },
                required: ["index"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "read_doc",
            description:
                "Read a Google Docs file that was returned from the most recent search_drive call. Select it by its numbered index from that list.",
            parameters: {
                type: "object",
                properties: {
                    index: {
                        type: "integer",
                        description:
                            "1-based index of the file from the last search_drive result (e.g. 1 for the first file)."
                    }
                },
                required: ["index"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "respond",
            description: "Return a natural language reply when no tools are needed.",
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