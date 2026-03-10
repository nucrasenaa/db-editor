import { NextRequest, NextResponse } from 'next/server';
import { getDbProxy } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { config, fullName, type, database } = await req.json();
        const targetDb = database || config.database;
        const dbProxy = await getDbProxy({ ...config, database: targetDb });

        try {
            const dialect = config.dbType || 'mssql';
            let script = '';

            if (dialect === 'mongodb' || dialect === 'redis') {
                return NextResponse.json({ success: false, message: 'DDL is not supported for NoSQL databases.' });
            }

            if (dialect === 'mssql') {
                if (type === 'table') {
                    // Simplified Table DDL generator for MSSQL
                    const query = `
                        SELECT 
                            c.name, 
                            ty.name as type, 
                            c.max_length, 
                            c.is_nullable,
                            ISNULL(i.is_primary_key, 0) as is_pk
                        FROM sys.columns c
                        JOIN sys.types ty ON c.user_type_id = ty.user_type_id
                        LEFT JOIN sys.index_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                        LEFT JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                        WHERE c.object_id = OBJECT_ID('[${targetDb}].${fullName}')
                    `;
                    const cols = await dbProxy.query(query);
                    script = `CREATE TABLE ${fullName} (\n`;
                    script += cols.map((c: any) => `  [${c.name}] ${c.type.toUpperCase()}${c.max_length > 0 ? `(${c.max_length})` : ''} ${c.is_nullable ? 'NULL' : 'NOT NULL'}${c.is_pk ? ' PRIMARY KEY' : ''}`).join(',\n');
                    script += `\n);`;
                } else {
                    const query = `SELECT definition FROM [${targetDb}].sys.sql_modules WHERE object_id = OBJECT_ID('[${targetDb}].${fullName}')`;
                    const result = await dbProxy.query(query);
                    script = result[0]?.definition || `-- No definition found for ${fullName}`;
                }
            } else {
                // Generic fallback for MySQL/Postgres
                const query = type === 'table' ? `SHOW CREATE TABLE ${fullName}` : `SHOW CREATE VIEW ${fullName}`;
                const result = await dbProxy.query(query);
                script = result[0]?.['Create Table'] || result[0]?.['Create View'] || JSON.stringify(result[0]);
            }

            return NextResponse.json({ success: true, script });
        } finally {
            await dbProxy.close();
        }
    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: error.message || 'Failed to get DDL' },
            { status: 500 }
        );
    }
}
