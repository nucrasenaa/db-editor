# 📖 Data Forge — User Guide

## 1. Connecting to a Database

Data Forge supports three primary modes of connection:

- **Manual Input**: Specify Server, Port, User, and Password fields individually.
- **Connection String**: Paste your full URI (e.g., `postgresql://user:pass@host:port/db`, `mssql://user:pass@host/db`).
- **Secure Caching**: Use the "Securely cache credentials" option to save your connection for future use without re-entering passwords.

### Environment Labels & Safety Settings *(v1.2.0)*
When creating or editing a connection, you can configure:
- **Environment Color** — Choose a color to visually distinguish the connection:
  - 🟢 Green = Development / Local
  - 🟠 Orange = Staging / Testing
  - 🔴 Red = Production (Critical)
  - 🟣 Purple = Analytics / Replica
- **Read-Only Mode (Safety Override)** — Enable this toggle to prevent any data-modifying queries (`UPDATE`, `DELETE`, `INSERT`, `DROP`, etc.) from being executed on this connection. The restriction is enforced at the server level and is bypass-proof.

---

## 2. Browsing & Exploring Data

- **Explorer Sidebar**: Browse Databases, Tables, Views, Procedures, and Synonyms from the left panel.
- **Click a Table**: Opens a paginated, sortable, filterable data view in a new tab.
- **Search**: Use the search bar at the top of the Explorer panel to find objects instantly.
- **Refresh Metadata**: Click the Refresh icon to reload the database object list.

---

## 3. Viewing & Editing Data

- **Inline Editing**: Double-click any cell in a Table View to edit it. Press `Enter` or click ✅ to save, `Escape` or ❌ to cancel.
- **Sorting**: Click any column header to sort ascending/descending.
- **Pagination**: Navigate pages using the footer controls and select page size (50 / 100 / 200 / 500 rows).

### Intelligent Filter *(v1.4.0)*
The standard table filter has been replaced with a context-aware **Intelligent Filter**:
- **Automatic Suggestions**: As you type into the "Filter" box, Data Forge suggests:
  - **Column Names** from the current table.
  - **SQL Keywords** (`AND`, `OR`, `LIKE`, `IN`, `IS NULL`, etc.).
  - **Operators** (`=`, `!=`, `>`, `<`, etc.).
- **Keyboard Friendly**: Navigate suggestions using `Arrow keys` and select with `Enter` or `Tab`. 
- **Auto-Positioning**: Smartly handles cursor placement and spacing after a selection.
- **Context-Aware**: Suggestions only appear when they are syntactically relevant.

### Bulk Row Deletion *(v1.2.0)*
1. Click checkboxes on the left side of rows to select them (or use the header checkbox to Select All).
2. The **Drop (N) Rows** red button appears in the footer.
3. Click it to permanently delete the selected rows after a confirmation prompt.

---

## 4. Data Masking (Privacy Protection) *(v1.2.0)*

Data Forge automatically detects **sensitive columns** by name and masks their values in table views.

**Detected column types**: `email`, `password`, `phone`, `ssn`, `national_id`, `credit_card`, `cvv`, `iban`, `salary`, `token`, `api_key`, `address`, `dob`, and more.

- A 🛡️ shield icon appears in the column header of any masked column.
- Masking is **ON by default**. You can toggle it using the **"Masked (N)"** button in the table footer.
- To reveal a single value, **click the cell** — only that cell is revealed; global masking remains active.
- **Exported data**: Export functions (CSV, Excel, JSON, SQL) export the raw unmasked values.

---

## 5. SQL Editor

The SQL editor is powered by Monaco (same engine as VS Code).

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + Enter` | Execute SQL (or selected text) |
| `Cmd/Ctrl + Shift + F` | Format SQL (uppercase keywords, clean indent) |
| `Cmd/Ctrl + K` | Open AI Copilot |
| `Cmd/Ctrl + E` | Explain Query (Execution Plan) |
| `Cmd/Ctrl + S` | Save Bookmark |
| `Cmd/Ctrl + \` | Clear Editor |

### SQL Linter *(v1.2.0)*
As you type, the linter automatically checks for:
- `SELECT *` — warns to specify columns
- `UPDATE` / `DELETE` without `WHERE` — **critical error alert**
- Leading `LIKE` wildcards (`'%value'`) — index-blocking pattern
- Non-sargable functions in `WHERE` clauses
- Missing column aliases on aggregate functions
- `WITH (NOLOCK)` dirty-read risk (MSSQL)

Issues appear in a collapsible panel below the editor. Click any issue for its fix suggestion. Click the code badge (e.g., `L002 L5:1`) to jump to the problem location in your editor.

---

## 6. Data Visualization

1. Open a query tab and run any query.
2. Switch to the **Chart** tab in the result view.
3. Select X and Y axis columns and chart type (Bar / Line / Pie).
4. Click **"Save to Dashboard"** to pin the chart to your Mini Dashboard.

---

## 7. AI Copilot

Press `Cmd/Ctrl + K` or click the ✨ Sparkles button in the SQL editor toolbar to open the AI Copilot overlay.

- Type your request in natural language (e.g., *"Show the top 10 customers by total sales this month"*).
- The AI uses your current database schema (tables, columns) for context.
- To configure your AI provider (OpenAI, Gemini, Anthropic, Ollama, etc.), go to the sidebar **AI Settings** section.

---

## 8. Advanced Tools

| Tool | Access | Description |
|---|---|---|
| **Table Designer** | Sidebar → ＋ Create Table | Visually create/alter tables without writing DDL |
| **View Designer** | Sidebar → ＋ Create View | Build views with a query editor and column alias UI |
| **Procedure Designer** | Sidebar → ＋ Create Procedure | Parameter definitions and body editor |
| **ER Diagram** | Sidebar → ER Architect | Auto-generate interactive ER diagrams from FK relationships |
| **Schema Compare** | Sidebar → Schema Compare | Diff two database schemas and generate migration scripts |
| **Server Monitor** | Sidebar → Server Monitor | Real-time CPU / memory / active sessions |
| **User Manager** | Sidebar → User Manager | Manage DB users, roles, and permissions |
| **Mock Data Generator** | Sidebar → Mock Data | Generate thousands of realistic dummy rows for testing |
| **Import Wizard** | Sidebar → Import | Bulk import CSV / JSON into existing tables |
| **Performance Advisor** | Sidebar → Advisor | Get AI-powered index optimization recommendations |
| **Mini Dashboards** | Sidebar → Dashboards | View your saved chart collection |

---

## 9. Theme Switching

- Toggle between **Light Mode** and **Dark Mode** using the button in the top-right corner of the Explorer screen.
- Your preference is saved automatically and restored on next launch with zero flicker.

---

## 10. Keyboard Shortcuts Reference

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + Enter` | Execute query |
| `Cmd/Ctrl + Shift + F` | Format SQL |
| `Cmd/Ctrl + K` | AI Copilot |
| `Cmd/Ctrl + E` | Explain / Query Plan |
| `Cmd/Ctrl + S` | Save Bookmark |
| `Cmd/Ctrl + \` | Clear editor |
| `Cmd/Ctrl + T` | New Query Tab |
| `Cmd/Ctrl + W` | Close current tab |
