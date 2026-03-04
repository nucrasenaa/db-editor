# 🚀 Data Forge | Feature Roadmap & Progress

This document tracks the development progress of **Data Forge**. It serves as a checklist for designers and AI agents to understand the current state and what needs to be implemented.

## 🛠 Project Status Summary
- **Primary Dialect**: MSSQL (SQL Server)
- **Secondary Dialects**: PostgreSQL, MySQL, MariaDB
- **Current Core**: Next.js + Electron + Monaco Editor + Basic CRUD

---

## 1. 📊 Data Utility (Data handling & Migration)
*Goal: Make data movement and schema inspection effortless.*

- [x] **Data Export Engine**
    - [x] Export to CSV
    - [x] Export to JSON
    - [ ] Export to Excel (XLSX)
    - [x] Export as SQL `INSERT`,`CREATE` Scripts
- [ ] **Visual Query Builder**
    - [ ] Drag-and-drop table fields
    - [ ] Visual Join manager
- [x] **Schema DDL Generator**
    - [x] "View Create Script" for Tables
    - [x] "View Create Script" for Views/Procedures
- [ ] **Import Wizard**
    - [ ] Import from CSV/JSON to existing tables

## 2. ⌨️ SQL Editor Enhancement (Developer Productivity)
*Goal: Provide a VS-Code-like experience for database administration.*

- [ ] **Local Query History**
    - [ ] Persistent log of executed queries (last 100)
    - [ ] Searchable history panel
- [ ] **Query Bookmarks & Snippets**
    - [ ] Save frequently used queries with custom names
    - [ ] Category-based management
- [ ] **Visual Execution Plan (Explain)**
    - [ ] Integration with `SET STATISTICS PROFILE ON` (MSSQL)
    - [ ] Visual node graph for Query Plan
- [ ] **Result Set Management**
    - [ ] Support for multiple result sets (Grid scrolling)
    - [ ] Named Result Tabs

## 3. 💎 Premium Aesthetics & UX (User Experience)
*Goal: Make the app feel like a top-tier, enterprise-grade tool.*

- [ ] **ER Diagram Viewer**
    - [ ] Auto-generate relationship graph from Foreign Keys
    - [ ] Draggable/Interactive nodes
- [ ] **Keyboard Shortcut System**
    - [ ] `Cmd/Ctrl + Enter`: Run Query
    - [ ] `Cmd/Ctrl + \`: Clear Results
    - [ ] `Cmd/Ctrl + P`: Search Tables (Quick Open)
- [ ] **Custom Themes**
    - [ ] Monaco Editor themes (Dracula, Monokai, Synthwave'84)
    - [ ] Transparent / Glassmorphism toggle
- [ ] **Multi-Window Support**
    - [ ] Ability to pop out a Query Tab into a new window

## 4. 🤖 AI Intelligence (Smart Assistance)
*Goal: Leverage LLMs to speed up database tasks.*

- [ ] **Database Copilot (Chat to SQL)**
    - [ ] AI input bar: "Show me all users from Bangkok who ordered in 2024"
    - [ ] Context-aware generation (AI knows your table schema)
- [ ] **SQL Fixer & Analyzer**
    - [ ] "Fix this Error" button on SQL Syntax errors
    - [ ] AI-driven index suggestions for slow queries

## 5. 🏗 Advanced Enterprise Features
*Goal: Tools for heavy-duty database management.*

- [ ] **Schema Comparison**
    - [ ] Compare Schema A vs Schema B
    - [ ] Generate Diff / Migration Script
- [ ] **Server Monitor & Log Viewer**
    - [ ] Real-time CPU/Memory usage tracking
    - [ ] Background Job / SQL Agent job monitor
- [ ] **User & Permission Manager**
    - [ ] Visual UI for managing DB Users, Roles, and Permissions

## 🏗 6. Schema Management & Creation (Designers)
*Goal: Provide visual designers for creating and altering database objects.*

- [x] **Visual Table Designer**
    - [x] Column management (Name, Type, Nullability, Primary Key)
    - [x] Constraint manager (Foreign Keys, Uniques, Checks)
    - [x] Index designer
- [x] **View Designer**
    - [x] Query-based view creation with syntax validation
- [x] **Procedure & Function Designer**
    - [x] Parameter definitions UI
    - [x] Template-based boilerplate generation

---

## 📝 Notes for AI Agents
- The project uses **Tailwind CSS** and **Lucide Icons**.
- Backend logic for database connection is located in `electron/db.js` and `electron/ipc-handlers.js`.
- Always check the `package.json` for installed drivers before implementing new dialect-specific features.
