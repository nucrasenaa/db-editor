/**
 * Utility to generate a compact schema context for AI prompts.
 * Focuses on table names and column names to keep token usage low.
 */

export function generateSchemaContext(metadata: any): string {
    if (!metadata || !metadata.tables) return "No schema information available.";

    let context = "DATABASE SCHEMA:\n";

    // Group by schema
    const tablesBySchema: Record<string, any[]> = {};
    metadata.tables.forEach((table: any) => {
        const schema = table.schema || 'dbo';
        if (!tablesBySchema[schema]) tablesBySchema[schema] = [];
        tablesBySchema[schema].push(table);
    });

    for (const schema in tablesBySchema) {
        context += `Schema: ${schema}\n`;
        tablesBySchema[schema].forEach(table => {
            const columns = metadata.columns?.filter((c: any) =>
                c.tableName === table.name && c.tableSchema === schema
            ) || [];

            const colList = columns.map((c: any) => `${c.name} (${c.type}${c.isNullable ? '?' : ''})`).join(', ');
            context += `  Table: ${table.name} [${colList}]\n`;
        });
    }

    return context;
}

/**
 * Detects if a SQL query is a data modification query (DML/DDL) or a safe read query (DQL).
 */
export function analyzeQuerySafety(sql: string): { isSafe: boolean; type: string } {
    const trimmed = sql.trim().toUpperCase();

    if (trimmed.startsWith('SELECT')) {
        return { isSafe: true, type: 'SELECT' };
    }

    if (trimmed.startsWith('INSERT')) return { isSafe: false, type: 'INSERT' };
    if (trimmed.startsWith('UPDATE')) return { isSafe: false, type: 'UPDATE' };
    if (trimmed.startsWith('DELETE')) return { isSafe: false, type: 'DELETE' };
    if (trimmed.startsWith('DROP')) return { isSafe: false, type: 'DROP' };
    if (trimmed.startsWith('ALTER')) return { isSafe: false, type: 'ALTER' };
    if (trimmed.startsWith('TRUNCATE')) return { isSafe: false, type: 'TRUNCATE' };
    if (trimmed.startsWith('CREATE')) return { isSafe: false, type: 'CREATE' };

    // Default to unsafe if not recognized as SELECT
    return { isSafe: false, type: 'OTHER' };
}
