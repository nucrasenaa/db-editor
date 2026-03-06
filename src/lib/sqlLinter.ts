// SQL Linter & Formatter
// Dialect-aware rule-based analysis for common SQL anti-patterns

export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintIssue {
    line: number;       // 1-indexed
    col: number;        // 1-indexed
    severity: LintSeverity;
    code: string;       // e.g. 'L001'
    message: string;
    suggestion?: string;
}

interface LintRule {
    code: string;
    severity: LintSeverity;
    check: (sql: string, lines: string[], dbType?: string) => LintIssue[];
}

// Helper: find line/col for a regex match position
function positionOf(sql: string, index: number): { line: number; col: number } {
    const before = sql.substring(0, index);
    const lines = before.split('\n');
    return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

// Helper: strip string literals and comments to avoid false positives
function stripSafeZones(sql: string): string {
    return sql
        .replace(/'[^']*'/g, match => ' '.repeat(match.length))      // Remove string literals
        .replace(/--[^\n]*/g, match => ' '.repeat(match.length))      // Remove line comments
        .replace(/\/\*[\s\S]*?\*\//g, match => ' '.repeat(match.length)); // Remove block comments
}

const RULES: LintRule[] = [
    // L001: SELECT * usage
    {
        code: 'L001',
        severity: 'warning',
        check: (sql, lines) => {
            const issues: LintIssue[] = [];
            const clean = stripSafeZones(sql);
            const rx = /\bSELECT\s+\*/gi;
            let m;
            while ((m = rx.exec(clean)) !== null) {
                const pos = positionOf(sql, m.index);
                issues.push({
                    ...pos,
                    severity: 'warning',
                    code: 'L001',
                    message: '`SELECT *` retrieves all columns — may cause performance issues and break code if schema changes.',
                    suggestion: 'Specify only the columns you need (e.g. SELECT id, name, email FROM ...)'
                });
            }
            return issues;
        }
    },

    // L002: UPDATE without WHERE
    {
        code: 'L002',
        severity: 'error',
        check: (sql) => {
            const issues: LintIssue[] = [];
            const clean = stripSafeZones(sql);
            // Find UPDATE ... SET blocks without follow-up WHERE
            const stmts = clean.split(/;/);
            let offset = 0;
            for (const stmt of stmts) {
                const hasUpdate = /\bUPDATE\b/i.test(stmt);
                const hasSet = /\bSET\b/i.test(stmt);
                const hasWhere = /\bWHERE\b/i.test(stmt);
                if (hasUpdate && hasSet && !hasWhere) {
                    const idx = stmt.search(/\bUPDATE\b/i);
                    const pos = positionOf(sql, offset + idx);
                    issues.push({
                        ...pos,
                        severity: 'error',
                        code: 'L002',
                        message: 'UPDATE without a WHERE clause will update ALL rows in the table!',
                        suggestion: 'Add a WHERE clause to target specific rows. Use a transaction if testing in production.'
                    });
                }
                offset += stmt.length + 1;
            }
            return issues;
        }
    },

    // L003: DELETE without WHERE
    {
        code: 'L003',
        severity: 'error',
        check: (sql) => {
            const issues: LintIssue[] = [];
            const clean = stripSafeZones(sql);
            const stmts = clean.split(/;/);
            let offset = 0;
            for (const stmt of stmts) {
                const hasDelete = /\bDELETE\b/i.test(stmt);
                const hasWhere = /\bWHERE\b/i.test(stmt);
                const hasFrom = /\bFROM\b/i.test(stmt);
                if (hasDelete && hasFrom && !hasWhere) {
                    const idx = stmt.search(/\bDELETE\b/i);
                    const pos = positionOf(sql, offset + idx);
                    issues.push({
                        ...pos,
                        severity: 'error',
                        code: 'L003',
                        message: 'DELETE without a WHERE clause will delete ALL rows in the table!',
                        suggestion: 'Add a WHERE clause to target specific rows. Consider TRUNCATE for full table clear.'
                    });
                }
                offset += stmt.length + 1;
            }
            return issues;
        }
    },

    // L004: Non-sargable LIKE with leading wildcard
    {
        code: 'L004',
        severity: 'warning',
        check: (sql) => {
            const issues: LintIssue[] = [];
            const clean = stripSafeZones(sql);
            const rx = /\bLIKE\s+'%[^%]/gi;
            let m;
            while ((m = rx.exec(clean)) !== null) {
                const pos = positionOf(sql, m.index);
                issues.push({
                    ...pos,
                    severity: 'warning',
                    code: 'L004',
                    message: 'Leading wildcard in LIKE ("%value") prevents index usage, causing full table scan.',
                    suggestion: 'Use a trailing wildcard ("value%") when possible, or consider Full-Text Search.'
                });
            }
            return issues;
        }
    },

    // L005: Function in WHERE clause (non-sargable)
    {
        code: 'L005',
        severity: 'warning',
        check: (sql) => {
            const issues: LintIssue[] = [];
            const clean = stripSafeZones(sql);
            // Common functions on columns in WHERE = non-sargable
            const rx = /\bWHERE\b[\s\S]*?\b(YEAR|MONTH|DAY|DATEPART|CONVERT|CAST|LOWER|UPPER|LEN|SUBSTRING|ISNULL|COALESCE)\s*\(/gi;
            let m;
            while ((m = rx.exec(clean)) !== null) {
                const pos = positionOf(sql, m.index);
                issues.push({
                    ...pos,
                    severity: 'warning',
                    code: 'L005',
                    message: `Using \`${m[1].toUpperCase()}()\` on a column in WHERE prevents index usage.`,
                    suggestion: 'Consider filtering on the raw column value or use a computed/persisted column.'
                });
            }
            return issues;
        }
    },

    // L006: SELECT without FROM (might be intentional but worth noting)
    // Skipping this as it's valid (e.g. SELECT GETDATE(), SELECT 1)

    // L007: Using != instead of <> (style)
    {
        code: 'L007',
        severity: 'info',
        check: (sql, lines, dbType) => {
            if (dbType === 'mysql' || dbType === 'mariadb') return []; // != is fine in MySQL
            const issues: LintIssue[] = [];
            const clean = stripSafeZones(sql);
            const rx = /!=/g;
            let m;
            while ((m = rx.exec(clean)) !== null) {
                const pos = positionOf(sql, m.index);
                issues.push({
                    ...pos,
                    severity: 'info',
                    code: 'L007',
                    message: '`!=` is non-standard SQL. Prefer the ANSI standard `<>` for better portability.',
                    suggestion: 'Replace `!=` with `<>`'
                });
            }
            return issues;
        }
    },

    // L008: Missing column alias in aggregation SELECT
    {
        code: 'L008',
        severity: 'info',
        check: (sql) => {
            const issues: LintIssue[] = [];
            const clean = stripSafeZones(sql);
            // Detects things like SELECT COUNT(*) FROM ... without an alias
            const rx = /\bSELECT\b[\s\S]*?\b(COUNT|SUM|AVG|MAX|MIN)\s*\([^)]*\)(?!\s+AS\b)(?!\s+\w)/gi;
            let m;
            while ((m = rx.exec(clean)) !== null) {
                const pos = positionOf(sql, m.index);
                issues.push({
                    ...pos,
                    severity: 'info',
                    code: 'L008',
                    message: `Aggregate function \`${m[1].toUpperCase()}()\` has no column alias.`,
                    suggestion: `Add an alias: \`${m[1].toUpperCase()}(...) AS total_count\``
                });
            }
            return issues;
        }
    },

    // L009: ORDER BY without TOP/LIMIT in MSSQL/MySQL subquery (performance hint)
    {
        code: 'L009',
        severity: 'info',
        check: (sql) => {
            const issues: LintIssue[] = [];
            const clean = stripSafeZones(sql);
            const hasOrderBy = /\bORDER\s+BY\b/i.test(clean);
            const hasLimit = /\b(TOP|LIMIT|FETCH\s+NEXT)\b/i.test(clean);
            const hasSubquery = /\(\s*SELECT\b/i.test(clean);
            if (hasOrderBy && !hasLimit && !hasSubquery) {
                // Only warn if it's a standalone SELECT without outer context
                const pos = positionOf(sql, (clean.search(/\bORDER\s+BY\b/i)));
                issues.push({
                    ...pos,
                    severity: 'info',
                    code: 'L009',
                    message: 'ORDER BY without LIMIT/TOP/FETCH may sort unnecessarily if only partial results needed.',
                    suggestion: 'Add TOP N, LIMIT N, or FETCH NEXT N ROWS ONLY to constrain the result set.'
                });
            }
            return issues;
        }
    },

    // L010: NOLOCK hint (MSSQL dirty reads warning)
    {
        code: 'L010',
        severity: 'warning',
        check: (sql, lines, dbType) => {
            if (dbType !== 'mssql') return [];
            const issues: LintIssue[] = [];
            const clean = stripSafeZones(sql);
            const rx = /WITH\s*\(\s*NOLOCK\s*\)/gi;
            let m;
            while ((m = rx.exec(clean)) !== null) {
                const pos = positionOf(sql, m.index);
                issues.push({
                    ...pos,
                    severity: 'warning',
                    code: 'L010',
                    message: '`WITH (NOLOCK)` can return dirty, uncommitted data.',
                    suggestion: 'Use READ COMMITTED or snapshot isolation instead for consistent reads.'
                });
            }
            return issues;
        }
    },
];

export function lintSQL(sql: string, dbType?: string): LintIssue[] {
    if (!sql || !sql.trim()) return [];
    const lines = sql.split('\n');
    const allIssues: LintIssue[] = [];

    for (const rule of RULES) {
        try {
            const found = rule.check(sql, lines, dbType);
            allIssues.push(...found);
        } catch (_) {
            // Silently fail linting rules
        }
    }

    // Sort by line, then col
    return allIssues.sort((a, b) => a.line !== b.line ? a.line - b.line : a.col - b.col);
}

// ─────────────────── FORMATTER ───────────────────

const SQL_KEYWORDS = [
    'SELECT', 'DISTINCT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
    'LIKE', 'BETWEEN', 'IS NULL', 'IS NOT NULL',
    'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN', 'CROSS JOIN', 'JOIN',
    'ON', 'AS', 'USING',
    'GROUP BY', 'HAVING', 'ORDER BY', 'ASC', 'DESC',
    'LIMIT', 'OFFSET', 'FETCH NEXT', 'ROWS ONLY',
    'TOP', 'PERCENT',
    'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    'CREATE TABLE', 'CREATE VIEW', 'CREATE PROCEDURE', 'CREATE FUNCTION', 'CREATE INDEX',
    'ALTER TABLE', 'DROP TABLE', 'TRUNCATE TABLE',
    'UNION ALL', 'UNION', 'INTERSECT', 'EXCEPT',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION',
    'DECLARE', 'EXEC', 'EXECUTE', 'RETURN',
    'WITH', 'AS',
    'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'COALESCE', 'ISNULL', 'NULLIF',
    'CAST', 'CONVERT', 'GETDATE', 'NOW', 'DATEADD', 'DATEDIFF',
    'OVER', 'PARTITION BY', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LEAD', 'LAG',
];

export interface FormatOptions {
    indentSize?: number;         // default 4
    uppercaseKeywords?: boolean; // default true
    newlineBeforeKeywords?: boolean; // default true
    commaStyle?: 'end' | 'start'; // default 'end'
}

export function formatSQL(sql: string, options: FormatOptions = {}): string {
    const {
        indentSize = 4,
        uppercaseKeywords = true,
        newlineBeforeKeywords = true,
        commaStyle = 'end',
    } = options;

    const indent = ' '.repeat(indentSize);

    // Tokenize preserving strings and comments
    const tokens: { type: 'string' | 'comment' | 'code'; value: string }[] = [];
    let remaining = sql;
    const tokenRx = /('(?:[^']|'')*'|"(?:[^"])*"|`(?:[^`])*`|--.+?(?=\n|$)|\/\*[\s\S]*?\*\/|[^'"`;,\-\/\s()]+|\s+|[();,]|--)/g;

    let formatted = sql;

    // Simple but effective: normalize whitespace, uppercase keywords, then insert newlines

    // Step 1: Normalize whitespace (collapse to single spaces, trim)
    formatted = formatted
        .replace(/\r\n/g, '\n')
        .replace(/\t/g, ' ')
        .replace(/  +/g, ' ')
        .trim();

    // Step 2: Uppercase keywords
    if (uppercaseKeywords) {
        // Sort by length descending so multi-word keywords match first
        const sorted = [...SQL_KEYWORDS].sort((a, b) => b.length - a.length);
        for (const kw of sorted) {
            const rx = new RegExp(`\\b${kw.replace(/ /g, '\\s+')}\\b`, 'gi');
            formatted = formatted.replace(rx, kw);
        }
    }

    // Step 3: Add newlines before major clauses
    if (newlineBeforeKeywords) {
        const majorClauses = [
            'SELECT', 'FROM', 'WHERE', 'AND', 'OR',
            'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN', 'CROSS JOIN', 'JOIN',
            'GROUP BY', 'HAVING', 'ORDER BY',
            'UNION ALL', 'UNION', 'INTERSECT', 'EXCEPT',
            'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
            'SET', 'VALUES', 'INSERT INTO', 'UPDATE', 'DELETE',
            'LIMIT', 'OFFSET',
        ];

        // Sort by length descending
        const sorted = [...majorClauses].sort((a, b) => b.length - a.length);
        for (const clause of sorted) {
            const rx = new RegExp(`(^|\\n|\\s)${clause.replace(/ /g, '\\s+')}\\b`, 'g');
            formatted = formatted.replace(rx, (match, pre) => `\n${clause}`);
        }
    }

    // Step 4: Handle comma style (commas on end keeps readable per line)
    if (commaStyle === 'start') {
        // Move commas to beginning of next line
        formatted = formatted.replace(/,\s*/g, '\n, ');
    } else {
        // Normalize comma spacing
        formatted = formatted.replace(/\s*,\s*/g, ', ');
    }

    // Step 5: Indent sub-clauses
    // Add indent for JOIN, AND, OR continuations relative to SELECT/FROM/WHERE
    const resultLines = formatted.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return '';

        // Top-level primary keywords — no indent
        const isPrimary = /^(SELECT|FROM|WHERE|UPDATE|DELETE|INSERT INTO|CREATE|ALTER|DROP|TRUNCATE|WITH|UNION|INTERSECT|EXCEPT|ORDER BY|GROUP BY|HAVING|LIMIT|OFFSET)\b/i.test(trimmed);

        // Secondary keywords — one indent
        const isSecondary = /^(AND|OR|INNER JOIN|LEFT JOIN|RIGHT JOIN|FULL OUTER JOIN|CROSS JOIN|JOIN|ON|SET|WHEN|THEN|ELSE|END|VALUES)\b/i.test(trimmed);

        if (isPrimary) return trimmed;
        if (isSecondary) return indent + trimmed;

        // Column lists get double indent
        return indent + indent + trimmed;
    });

    // Remove duplicate blank lines
    const finalLines: string[] = [];
    let lastBlank = false;
    for (const line of resultLines) {
        if (!line.trim()) {
            if (!lastBlank) finalLines.push('');
            lastBlank = true;
        } else {
            finalLines.push(line);
            lastBlank = false;
        }
    }

    return finalLines.join('\n').trim();
}
