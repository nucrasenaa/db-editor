# 📔 Data Forge Documentation Hub

Welcome to the official documentation for **Data Forge v1.4.0**. This hub serves as the primary resource for both users and developers to understand, utilize, and extend the application.

## 🚀 Getting Started
- **[User Guide](./USER_GUIDE.md)**: Connect to databases, browse and edit data, use all smart tools.
- **[Developer Guide](./DEVELOPER_GUIDE.md)**: Architecture overview, tech stack, and contribution guidelines.
- **[Dialect Support](./DIALECTS.md)**: MSSQL, PostgreSQL, MySQL, and MariaDB specifics.
- **[Troubleshooting](./TROUBLESHOOTING.md)**: Common issues and how to fix them.
- **[Release Notes](../RELEASE_NOTES.md)**: Version history and what's new.

---

## ✨ Feature Summary (v1.4.0)

| Category | Features |
|---|---|
| **Connectivity** | MSSQL, PostgreSQL, MySQL, MariaDB, Connection String URLs |
| **SQL Editor** | Monaco Editor, IntelliSense, History, Bookmarks, AI Copilot |
| **SQL Quality** | Real-time Linter (10 rules), Auto-Formatter (`Cmd+Shift+F`) |
| **Safety** | Environment Color Coding, Read-Only Mode, Safety Banner |
| **Privacy** | Data Masking (auto-detect PII, click-to-reveal) |
| **Data Editing** | Inline Cell Edit, Bulk Row Deletion, Filtering, Sorting |
| **Data Export** | CSV, JSON, Excel (XLSX), SQL INSERT Scripts |
| **Data Import** | CSV / JSON with Column Mapping Wizard |
| **AI** | OpenAI / Gemini / Anthropic / Ollama, SQL Fix, Advisor |
| **Designers** | Table, View, Procedure, Visual Query Builder |
| **Visualization** | Bar / Line / Pie Charts, Mini Dashboard Board |
| **Enterprise** | Schema Compare, Server Monitor, User Manager |
| **Dev Tools** | Mock Data Generator, ER Diagram, Performance Advisor |
| **UX** | Light/Dark Theme, Pop-Out Windows, Multi-Tab Workspace |

---

## 🔒 Security & Compliance

- **Read-Only Mode** — Server-enforced `SELECT`-only policy per connection (HTTP 403 on destructive queries)
- **Data Masking** — Automatic PII masking for sensitive columns (email, phone, SSN, credit cards, salary, etc.)
- **SQL Linter** — `UPDATE`/`DELETE` without `WHERE` flagged as critical errors before execution
- **Safety Banners** — Visual warnings throughout the UI when connected to critical environments

---

## 🔑 Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + Enter` | Execute SQL query |
| `Cmd/Ctrl + Shift + F` | Format SQL |
| `Cmd/Ctrl + K` | Open AI Copilot |
| `Cmd/Ctrl + E` | Explain / Execution Plan |
| `Cmd/Ctrl + S` | Save Bookmark |
| `Cmd/Ctrl + \` | Clear editor |
| `Cmd/Ctrl + T` | New Query Tab |
| `Cmd/Ctrl + W` | Close current tab |

---
*Data Forge v1.4.0 — Created by Three Man Dev © 2026, Bangkok, Thailand*
