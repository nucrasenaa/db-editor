# Data Forge v1.1.1

**Data Forge** is an enterprise-grade, high-performance database management studio and AI-powered SQL editor built with **Next.js** and **Electron**. It provides a unified, multi-tabbed workspace for managing **SQL Server (MSSQL)**, **PostgreSQL**, **MySQL**, and **MariaDB** with a premium aesthetic that adapts to your environment.

Optimized for high-productivity database engineering, Data Forge combines traditional administration tools with modern AI capabilities.

<img src="public/icon.png" width="60" height="60" alt="App Icon" />

---

## 🚀 Features (v1.1.1 Updates)

### 🎨 Premium Theme System
- **Light & Dark Mode Support** — Seamlessly switch between a high-contrast Light Mode and the signature Dark Mode.
- **Auto-Persistence** — Your theme preference is saved locally and restored instantly on launch with zero flicker.
- **Monaco Sync** — The SQL editor automatically synchronizes its visual style (vs-dark/light) with the application theme.
- **Default Light Branding** — Modernized initial experience with Light Mode as the new application default.

### 📖 Documentation Center
- **In-App Docs Port** — Accessible at `/documents`, providing deep-dive guides for both users and developers.
- **Markdown-Powered Knowledge Base** — Structured documentation for Dialect Support, API Reference, and Troubleshooting.
- **Direct Access** — One-click access from the Explorer screen footer.

### 🤖 AI Forge (Intelligence)
- **AI SQL Fixer** — Multi-step analysis with real-time reasoning feedback.
- **Cross-Database Intellisense** — Intelligent code completion across ALL explored databases simultaneously.
- **AI Performance Advisor** — Analyze execution plans and get actionable index recommendations using AI diagnostics.
- **"Explain with AI"** — Get human-readable breakdowns of complex SQL queries and execution plans.

### 🗂 Core Workspace & Connectivity
- **Tab Persistence** — Open tabs, SQL queries, and table views are saved and restored per database connection.
- **Auto-Connect** — Securely cached credentials support one-click connection directly from the dashboard.
- **Improved MySQL/MariaDB Core** — Optimized connection strings and fixed database-naming conflicts in update statements.
- **Consolidated Forge Sidebar** — Unified, collapsible section for all tools (Table/View Designers, AI, Monitor).

---

## 📊 Developer Tools & Utilities

- **The Designer Suite** — Visual builders for **Tables, Views, and Procedures/Functions**.
- **ER Architect** — Interactive entity-relationship diagrams generated from live database foreign keys.
- **Import Wizard** — High-speed data import from CSV/JSON.
- **Schema Comparison** — Identify and diff schema changes between two databases.
- **Server Health Monitor** — Real-time performance monitoring.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js](https://nextjs.org/) (App Router, Static Export) |
| **Desktop Wrapper** | [Electron](https://www.electronjs.org/) |
| **SQL Editor** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) |
| **Styling** | Vanilla CSS (Theme-aware) & Tailwind CSS |
| **Drivers** | `tedious` (MSSQL), `pg` (PostgreSQL), `mysql2` (MySQL) |

---

## 📦 Getting Started

### Installation & Development

1. Clone and Install:
   ```bash
   git clone https://github.com/nucrasenaa/db-editor.git
   cd db-editor
   yarn install
   ```

2. Run Environment:
   ```bash
   yarn dev           # Web Version
   yarn electron-dev  # Electron Version
   ```

### Build & Packaging
The application uses `electron-builder` for cross-platform production builds.

| Command | Output |
|---|---|
| `yarn build-mac` | macOS `.dmg` + `.zip` |
| `yarn build-win` | Windows `.exe` installer + `.zip` |
| `yarn build-all` | Universal Build |

---

## 🔒 Security & Architecture

- **Native IPC Core** — Critical database and AI logic is executed in the Electron Main process.
- **Credential Safety** — Passwords can be securely cached with encryption support.
- **Context Isolation** — Hardened security using `contextBridge`.

---

## 📄 Developers

**THREE MAN DEV** © 2026. ALL RIGHTS RESERVED.  
BANGKOK, THAILAND

## 📄 License

MIT License.
