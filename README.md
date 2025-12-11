# 🚀 Slack AI Agent (OpenAI + Google Drive + Slack)

A fully autonomous AI assistant for Slack that can:

* **Search and access** your Google Drive files.
* **Read and analyze** Google Sheets and Google Docs.
* Perform **multi-step workflows** using the file data.
* **Respond naturally** to general queries (e.g., "hello", "thanks").
* **Integrated with OpenAI's GPT** for intelligent responses.
* **Robust error handling** for Drive, Docs, and Sheets.

---

# 📁 Project Structure

```
monday-slack-bot/
├─ package.json               # Main dependencies & scripts
├─ package-lock.json          # Ensures consistent installs
├─ .gitignore                 # Ignores unnecessary files
├─ README.md                  # This file

├─ index.js                   # Main server & Slack event handler
├─ aiAgent.js                 # OpenAI client, SYSTEM_PROMPT + retry logic
├─ tools.js                   # OpenAI tool definitions (search_drive, read_sheet, etc.)
├─ toolHandlers.js            # Logic for handling tool calls (Drive, Sheets, Docs)
├─ driveTools.js              # Drive API helper functions (search, read, resolve shortcuts)
├─ memoryStore.js             # In-memory storage for user conversation history

# Optional / legacy files:
├─ mondayClient.js            # Monday.com API helper (not needed now)
├─ driveClient.js             # Google Sheets/Docs client (legacy, replaced by OAuth2)
├─ sheetAnalytics.js          # Analytics-specific logic (only for legacy files)
├─ openaiClient.js            # OpenAI-specific logic (legacy, merged into aiAgent.js)
```

---

# ⚙️ Requirements

* **Node.js 18+**
* **Slack Workspace** (with Slash Commands enabled)
* **Google Cloud Project** (Drive, Sheets, Docs APIs enabled)
* **Google OAuth2 Client ID & Secret**
* **OAuth2 Refresh Token** (for user authentication with Google Drive)
* **OpenAI API key**
* **Render** account for deployment

---

# 🔧 Environment Variables (required)

Add the following to **Render → Environment Variables**:

| Variable               | Description                                                                     |
| ---------------------- | ------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`       | Your OpenAI API key                                                             |
| `GOOGLE_CLIENT_ID`     | Your Google OAuth Client ID                                                     |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret                                                 |
| `GOOGLE_REDIRECT_URI`  | OAuth callback URL (e.g., `https://your-app.onrender.com/auth/google/callback`) |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 Refresh Token (obtained during OAuth authorization flow)                 |
| `SLACK_BOT_TOKEN`      | Slack Bot User OAuth Token (xoxb-...)                                           |

You can get these values by:

* **Google OAuth**: Set up OAuth2 in Google Cloud Console and get the `Client ID`, `Client Secret`, and `Refresh Token`.
* **Slack Bot Token**: Create a Slack App, add required OAuth Scopes, and install it to your workspace.

---

# 🧠 How the Agent Works

### 1. User sends a Slack message:

```text
/yourbot search "MBO AI Training"
```

### 2. Render receives the payload and passes it to the agent:

* **Searches Google Drive** using the query `"MBO AI Training"`
* **Returns file results** with `index`, `id`, `name`, and `mimeType`

### 3. User selects a file (e.g., "1"):

```text
1
```

### 4. Agent resolves the file based on index:

* **Fetches the `fileId`** and checks if it’s a **Google Sheet** or **Google Doc**.
* Calls **read_sheet** or **read_doc** accordingly.

### 5. Agent outputs a summary of the file:

* Displays the content of the file, or specific sections based on the query.

---

# 🧩 Supported Commands / Examples

### 🟢 **General Chat**

```text
/yourbot hello
/yourbot what can you do?
```

### 🟢 **Search Google Drive**

```text
/yourbot search "MBO AI Training"
```

### 🟢 **Read a Spreadsheet**

```text
/yourbot In the spreadsheet titled "MBO Leads & Ads Spend", what was yesterday’s spend?
```

### 🟢 **Analyze Sheet Data**

```text
/yourbot what are the last 7 days of spend in the "MBO Leads & Ads Spend" sheet?
```

### 🟢 **Read a Google Doc**

```text
/yourbot open the document titled "Onboarding SOP" and summarize it
```

### 🟢 **Multi-Step Workflows**

```text
/yourbot search my drive for onboarding files
/yourbot open the second file
/yourbot summarize the last section
/yourbot rewrite as bullet points
```

---

# 🧰 Installation

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/monday-slack-bot.git
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

# 🛠 Google Cloud Setup (OAuth2)

1. Go to **Google Cloud Console** → Create a new project (or use an existing one).
2. Enable the **Google Drive API**, **Google Sheets API**, and **Google Docs API**.
3. Go to **APIs & Services → Credentials** → Create **OAuth 2.0 Client IDs**.
4. Set the **Redirect URI** for your app to:

   ```text
   https://your-app.onrender.com/auth/google/callback
   ```
5. Download the credentials JSON and copy the **Client ID** and **Client Secret** into your `.env` file.
6. Authorize your app with Google to get the **OAuth2 refresh token** and store it in the `.env` file.

   * Visit:

     ```text
     https://your-app.onrender.com/auth/google
     ```

---

# 🔗 Slack Setup (Bot)

1. Go to **Slack API → Your Apps** → Create a new Slack App.
2. Enable **OAuth Scopes**:

   * `chat:write` (to send messages)
   * `im:history` (to read direct messages)
   * `im:read` (to read DMs)
   * `app_mentions:read` (to detect @mentions)
3. Create a **Slash Command**:

   * Command: `/yourbot`
   * Request URL:

     ```text
     https://your-app.onrender.com/slack/command
     ```
4. Install the app to your workspace and get the **Bot Token** (`xoxb-...`).

---

# 🚀 Deploy on Render

1. Create a new **Web Service** on **Render**.
2. Connect your GitHub repository.
3. Set the **build command** to:

   ```bash
   npm install
   ```
4. Set the **start command** to:

   ```bash
   node index.js
   ```
5. Add environment variables in the **Render Dashboard**.
6. Deploy.

---

# 🔍 Debugging Tips

### See tool calls:

Check Render logs for:

```json
"tool_calls": [
  {
    "id": "call_abc123",
    "type": "function",
    "function": {
      "name": "search_drive",
      "arguments": "{ \"query\": \"MBO AI Training\" }"
    }
  }
]
```

### Common issues:

| Issue                         | Fix                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| **"Unknown tool: undefined"** | Ensure that `tools.js` is correctly structured with `function` name and arguments.     |
| **JSON parse error**          | Check if `tool arguments` are properly structured and valid JSON.                      |
| **Rate limit (429)**          | Switch to `gpt-4.1-mini`, optimize memory storage, and use retry logic for tool calls. |
| **File not found (404)**      | Ensure the correct `fileId` is used for the document. Validate IDs and mimeTypes.      |

---

# ⭐ Future Improvements (optional)

* Persistent memory using **Redis**
* Support for **reading PDFs** and **images**
* **Email automation**
* AI workflows triggered by Slack **reactions**
* Integration with **Monday.com** (on hold)

---

# 🙌 Credits

Built with ❤️ by [Raven](https://www.rjsnavarette.com "Raven's Website") using:

* **OpenAI GPT-4** for natural language processing
* **Google Cloud APIs** (Drive, Sheets, Docs) for file access
* **Slack API** for Slack integration
* **Render** for deployment