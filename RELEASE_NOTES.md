# 🚀 Data Forge Release Notes

## [v1.1.1] - 2026-03-05
### High-Performance Styling & Documentation
- **Premium Theme System**: Introduced a fully integrated **Light Mode** and **Dark Mode** toggle.
- **Auto-Theme Detection**: Persistent theme selection via `localStorage` with flicker-free loading scripts.
- **Theme Parity**: Monaco SQL Editor now deep-links with the application theme (vs-dark/light).
- **Default Theme Change**: **Light Mode** is now the default theme for a cleaner initial experience.
- **Documentation Center**: Launched the built-in `/documents` portal with comprehensive guides for users and developers.
- **Version Tracking**: Unified versioning across the UI, Documentation, and Package metadata.

## [v1.1.0] - 2026-03-05
### Smart Updates & Dialect Parity
- **Cross-Dialect Update Logic**: Refined `UPDATE` query generation for MSSQL, MySQL, and PostgreSQL.
- **Affected Rows Precision**: Improved `rowsAffected` and `rowCount` detection logic across different database drivers.
- **Smart Targeting**: Inline editing now prioritizes `id`, `uuid`, or `pk` columns for safer `WHERE` clause generation.
- **Redundant Naming Fix**: Resolved the "db.db.table" naming conflict in MariaDB update statements.
- **MSSQL Crash Fix**: Resolved "Cannot read properties of undefined (reading 'rowsAffected')" for SQL Server.
- **Defensive Error Handling**: Non-destructive alerts when attempted updates on views or query results with non-identifiable tables.

---

## [v1.0.0] - 2026-03-05
### The Official Launch
- **Official Product Release**
- **The Designer Suite**: Introduced Table, View, Procedure, and Visual Query designers.
- **AI Forge**: AI-powered code completion, performance advisor, and SQL fixer.
- **Enterprise Utilities**: Schema comparison, Import Wizard, and Server Monitor.
- **Obsidian-Glass Aesthetic**: Premium dark theme (v1.0.0 default).
- **Native IPC Core**: Production-ready stability via Electron.

---
*Built with ❤️ for Database Engineers.*
