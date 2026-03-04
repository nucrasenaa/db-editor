# Data Forge

**Data Forge** is a premium, high-performance database explorer and SQL editor built with **Next.js** and **Electron**. It provides a seamless, multi-tabbed workspace for managing multiple database dialects — including **SQL Server (MSSQL)**, **PostgreSQL**, **MySQL**, and **MariaDB** — with a design philosophy inspired by the best developer tools in the industry.

Optimized for both web and desktop environments, it offers secure, persistent, and blazing-fast database management with an enterprise-grade aesthetic.

![App Icon](public/icon.png)

---

## 🚀 Features

### 🗂 Core Workspace
- **Multi-Tab Workspace** — Open multiple tables, views, and custom query editors simultaneously. Switch tasks without losing context.
- **Multi-Window Support** — Pop out any tab into a standalone browser/native window for true multi-monitor workflows.
- **Connection History** — Securely save and quickly reconnect to previous database sessions.
- **Multi-Dialect Support** — Native support for MSSQL, PostgreSQL, MySQL, and MariaDB with dialect-aware SQL generation.

### ⌨️ SQL Editor
- **Monaco-Powered Editor** — Intelligent SQL editing powered by Monaco Editor (the engine behind VS Code), with syntax highlighting, schema-aware autocomplete, and multi-cursor editing.
- **Visual Query Builder** — Drag-and-drop interface to build SQL queries by selecting tables and columns from your live schema.
- **Local Query History** — Searchable log of the last 100 executed queries with one-click replay.
- **Query Bookmarks & Snippets** — Save frequently used queries with custom names and category management.
- **Result Set Management** — Automatic tabbed navigation for multi-result-set queries.

### 📊 Data & Schema Tools
- **Data Export Engine** — Export query results to CSV, JSON, Excel (XLSX), and SQL INSERT/CREATE scripts.
- **Import Wizard** — Import data from CSV and JSON files directly into existing tables.
- **Visual Table Designer** — Column management (name, type, nullability, PK), constraints (foreign keys, uniques, checks), and index design.
- **View & Procedure Designer** — Query-based view creation and template-based procedure generation with parameter definitions.
- **Schema DDL Generator** — Generate `CREATE` scripts for any table, view, or stored procedure.
- **ER Diagram Viewer (ER Architect)** — Auto-generate an interactive entity-relationship (ER) diagram from your database's foreign key relationships. Drag, zoom, and pan the canvas.

### 🤖 Developer Productivity
- **Visual Execution Plan (Explain)** — Visualize query execution plans as a hierarchical node tree (MSSQL: `STATISTICS PROFILE`, MySQL/PostgreSQL: `EXPLAIN`).
- **Procedural Snippets** — Auto-generate `EXEC` or `CALL` statements with parameter placeholders for stored procedures.
- **Inline Data Editing** — Edit cell values directly in the results grid with automatic `WHERE` clause generation for safe, targeted updates.
- **Keyboard Shortcuts** — Full shortcut system: `Cmd/Ctrl+Enter` (Run), `Cmd/Ctrl+T` (New Tab), `Cmd/Ctrl+W` (Close Tab), `Cmd/Ctrl+P` (Quick Search).

### 💎 Design & UX
- **Premium Dark Mode** — Obsidian-Glass aesthetic with backdrop blur, glassmorphism, and sapphire accent colors.
- **Smooth Micro-Animations** — Polished transitions and hover effects throughout the UI.
- **URL Connection Mode** — Connect directly using a standard database URL string (e.g., `mysql://user:pass@host/db`).

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js](https://nextjs.org/) (App Router, Static Export) |
| **Desktop Wrapper** | [Electron](https://www.electronjs.org/) |
| **SQL Editor** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) |
| **Styling** | Tailwind CSS & Lucide Icons |
| **DB Drivers** | `tedious` (MSSQL), `pg` (PostgreSQL), `mysql2` (MySQL/MariaDB) |

---

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [yarn](https://yarnpkg.com/) (recommended) or npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/nucrasenaa/db-editor.git
   cd db-editor
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

### Development

Run the **web version**:
```bash
yarn dev
```

Run the **Electron desktop version** (requires the web dev server to be running):
```bash
yarn electron-dev
```

---

## 🏗 Build & Packaging

The application is configured for production cross-platform builds using `electron-builder`.

| Command | Output |
|---|---|
| `yarn build-mac` | macOS `.dmg` + `.zip` |
| `yarn build-win` | Windows `.exe` installer + `.zip` |
| `yarn build-all` | All platforms |

All build artifacts will be located in the `dist/` directory.

---

## 🔒 Security

- **Direct IPC Link** — Desktop version connects directly to databases via Node.js native drivers, bypassing CORS and external API proxies.
- **Credential Caching** — Passwords are stored in `localStorage` *only* if the user explicitly enables "Remember Password."
- **Context Isolation** — Electron's `contextBridge` is used to safely expose IPC methods without granting full Node.js access to the renderer.

---

## 📄 Developers

**THREE MAN DEV** © 2026. ALL RIGHTS RESERVED.
BANGKOK, THAILAND

## 📄 License

This project is licensed under the MIT License.
