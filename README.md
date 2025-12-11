# 🚀 Slack AI Agent (OpenAI + Google Drive + Slack)

A fully autonomous AI assistant for Slack that can:

* Talk like ChatGPT
* Search your Google Drive
* Read and analyze Google Sheets
* Read and summarize Google Docs
* Perform multi-step workflows (memory-based)
* Respond normally to general conversation
* Run on Render using Node.js

Built with:

* **OpenAI tool calling (gpt-4.1-mini)**
* **Google Drive, Docs, Sheets APIs**
* **Slack slash commands**
* **Node.js + Express**

---

# 📁 Project Structure

```
monday-slack-bot/
├─ index.js               # Main server, Slack handler, agent loop
├─ aiAgent.js             # OpenAI client + SYSTEM_PROMPT + retry logic
├─ tools.js               # OpenAI tool definitions
├─ toolHandlers.js        # Maps tool calls → Google API functions
├─ driveTools.js          # Drive, Sheets, Docs logic (Google APIs)
├─ memoryStore.js         # In-memory conversation history

# Optional / legacy (used before the agent system)
├─ mondayClient.js
├─ driveClient.js
├─ sheetAnalytics.js
├─ openaiClient.js
```

---

# ⚙️ Requirements

* Node.js 18+
* Slack Workspace (with Slash Commands enabled)
* Google Cloud Project
* Google Service Account (Drive + Sheets + Docs read access)
* OpenAI API key
* Render.com account for deployment

---

# 🔧 Environment Variables (required)

Set these in **Render → Environment Variables**:

| Variable                      | Description                                         |
| ----------------------------- | --------------------------------------------------- |
| `OPENAI_API_KEY`              | Your OpenAI API key                                 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON string of your Google service account key |
| `PORT`                        | Port Render will bind to (defaults to 3000)         |

**Note:**
`GOOGLE_SERVICE_ACCOUNT_JSON` must be the **entire JSON object**, exactly as downloaded, with newline escapes (`\n`) preserved inside the private key.

---

# 🧠 How the Agent Works

### 1. User sends a Slack message:

```
/mondaybot search my drive for "MBO"
```

### 2. Render receives the payload

`index.js` logs the message and loads conversation history.

### 3. OpenAI interprets the message

The model decides whether to:

* Respond normally (`respond`)
* Call a tool:

  * `search_drive`
  * `read_sheet`
  * `read_doc`

### 4. Tools are executed

`toolHandlers.js` routes the call to:

* `driveTools.js → findInDrive()`
* `driveTools.js → readSheet()`
* `driveTools.js → readDoc()`

### 5. Tool output is returned to OpenAI

The model uses the real file data to answer the question.

### 6. Final answer is posted to Slack

Sent via Slack `response_url`.

---

# 🧩 Supported Commands / Examples

### 🟢 General Chat

```
/mondaybot hello
/mondaybot what can you do?
```

### 🟢 Search Google Drive

```
/mondaybot search my drive for "billing"
```

### 🟢 Read a Spreadsheet

```
/mondaybot in the spreadsheet titled "MBO Leads & Ads Spend", what was yesterday’s spend?
```

### 🟢 Analyze Sheet Data

```
/mondaybot what are the last 7 days of spend in the 'MBO Leads & Ads Spend' sheet?
```

### 🟢 Read a Google Doc

```
/mondaybot open the document titled "Onboarding SOP" and summarize it
```

### 🟢 Multi-Step Workflows

```
/mondaybot search my drive for onboarding files
/mondaybot open the second file
/mondaybot summarize the last section
/mondaybot rewrite as bullet points
```

---

# 🧰 Installation

### 1. Clone repo

```bash
git clone https://github.com/yourname/monday-slack-bot.git
cd monday-slack-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run locally

```bash
node index.js
```

---

# 🛠 Google Cloud Setup (Service Account)

1. Go to Google Cloud → IAM & Admin → Service Accounts
2. Create new Service Account
3. Add a key → JSON → Download
4. Enable APIs:

   * Google Drive API
   * Google Sheets API
   * Google Docs API
5. Share any Drive files you want accessible with your service account’s email

   ```
   your-service-account@project-id.iam.gserviceaccount.com
   ```

---

# 🔗 Slack Setup (Slash Command)

1. Go to Slack → Build → Slash Commands
2. Create a command:

   ```
   /mondaybot
   ```
3. Set Request URL:

   ```
   https://your-render-app.onrender.com/slack/command
   ```
4. Save

---

# 🚀 Deploy on Render

1. Create new Web Service
2. Connect GitHub repo
3. Set build command:

   ```
   npm install
   ```
4. Set start command:

   ```
   node index.js
   ```
5. Add environment variables
6. Deploy

---

# 🔍 Debugging Tips

### See tool calls:

Check Render logs — they will show:

```json
"tool_calls": [
  {
    "id": "...",
    "type": "function",
    "function": {
      "name": "search_drive",
      "arguments": "{ \"query\": \"MBO\" }"
    }
  }
]
```

### Common issues:

| Issue                     | Fix                                                               |
| ------------------------- | ----------------------------------------------------------------- |
| “Unknown tool: undefined” | Using wrong tool format — ensure tools.js uses `type: "function"` |
| JSON parse error          | Check if tool arguments are valid JSON                            |
| 429 rate limit            | Uses GPT-4.1-mini + retry logic                                   |
| No data returned          | Ensure Drive files are shared with service account                |

---

# ⭐ Future Improvements (optional)

* Persistent memory using Redis
* Support for reading PDFs
* Email automation
* AI workflows triggered by Slack reactions
* Monday.com integration (on hold)

---

# 🙌 Credits

Built collaboratively using:

* OpenAI API
* Google Cloud APIs
* Slack slash commands
* Render.com