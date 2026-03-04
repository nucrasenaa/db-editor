# SQL Forge

SQL Forge is a modern, high-performance database explorer and SQL editor built with Next.js and Electron. It provides a seamless, multi-tabbed interface for managing multiple database dialects including **SQL Server (MSSQL)**, **PostgreSQL**, **MySQL**, and **MariaDB**.

![App Icon](public/icon.png)

## 🚀 Features

- **Multi-Tab Workspace**: Open multiple tables, views, and custom query editors simultaneously. Switch between tasks without losing context.
- **Multi-Dialect Support**: Native support for MSSQL, PostgreSQL, MySQL, and MariaDB with dialect-aware SQL snippet generation.
- **Desktop Ready (Electron)**: Built-in Electron support to bypass browser network restrictions, allowing direct connections even behind VPNs or complex network environments.
- **Intelligent SQL Editor**: Powered by Monaco Editor (the core of VS Code) with syntax highlighting and basic autocomplete for keywords and schema objects.
- **Procedural Snippets**: Automatically fetch procedure parameters and generate `EXEC` or `CALL` statements with placeholders.
- **Inline Editing**: Edit data directly within the results grid with automatic `WHERE` condition generation for safe updates.
- **Connection History**: Securely save connection configurations. Opt-in for password caching to jump back into your databases instantly.
- **Modern Aesthetics**: Premium dark-mode interface with glassmorphism effects and smooth micro-animations.

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Desktop Wrapper**: [Electron](https://www.electronjs.org/)
- **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- **Styling**: Tailwind CSS & Vanilla CSS
- **Icons**: [Lucide React](https://lucide.dev/)
- **Database Drivers**: `tedious` (MSSQL), `pg` (Postgres), `mysql2` (MySQL/MariaDB)

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/sql-forge.git
   cd sql-forge
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Run the web version:
```bash
npm run dev
```

Run the Electron desktop version:
```bash
npm run electron-dev
```

## 🏗 Build & Packaging

To build the web application:
```bash
npm run build
```

To package the application for desktop distribution (using your preferred builder):
```bash
# Example if using electron-builder
npm run build && npx electron-builder
```

## 🔒 Security

- **Credential Caching**: Passwords are saved in the user's local storage only if the "Securely Cache Credentials" option is checked.
- **Encrypted Transmission**: Ensure your database connections use SSL/TLS for production environments.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
