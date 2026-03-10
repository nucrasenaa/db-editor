import { NextRequest, NextResponse } from 'next/server';
import { getDbProxy } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { dbType, ...config } = await req.json();
        const dialect = dbType || 'mssql';
        const dbProxy = await getDbProxy({ ...config, dbType: dialect });

        try {
            if (dialect === 'mongodb' || dialect === 'redis') {
                return NextResponse.json({
                    success: true,
                    tables: [],
                    relationships: []
                });
            }

            let tablesResult: any[] = [];
            let fksResult: any[] = [];

            if (dialect === 'mssql') {
                const tablesQuery = `
                    SELECT 
                        s.name AS [Schema],
                        t.name AS [Table], 
                        c.name AS [Column], 
                        ty.name AS [Type], 
                        c.is_nullable AS [Nullable],
                        ISNULL((SELECT 1 FROM sys.index_columns ic 
                                JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                                WHERE ic.object_id = t.object_id AND ic.column_id = c.column_id AND i.is_primary_key = 1), 0) AS [PK]
                    FROM sys.tables t
                    JOIN sys.schemas s ON t.schema_id = s.schema_id
                    JOIN sys.columns c ON t.object_id = c.object_id
                    JOIN sys.types ty ON c.user_type_id = ty.user_type_id
                    ORDER BY s.name, t.name, c.column_id
                `;
                const fksQuery = `
                    SELECT 
                        tab1.name AS [Table],
                        col1.name AS [Column],
                        tab2.name AS [ReferencedTable],
                        col2.name AS [ReferencedColumn]
                    FROM sys.foreign_key_columns fkc
                    INNER JOIN sys.tables tab1 ON tab1.object_id = fkc.parent_object_id
                    INNER JOIN sys.columns col1 ON col1.column_id = parent_column_id AND col1.object_id = tab1.object_id
                    INNER JOIN sys.tables tab2 ON tab2.object_id = fkc.referenced_object_id
                    INNER JOIN sys.columns col2 ON col2.column_id = referenced_column_id AND col2.object_id = tab2.object_id
                `;
                tablesResult = await dbProxy.query(tablesQuery);
                fksResult = await dbProxy.query(fksQuery);
            } else if (dialect === 'mysql' || dialect === 'mariadb') {
                const tablesQuery = `
                    SELECT 
                        TABLE_SCHEMA AS \`Schema\`,
                        TABLE_NAME AS \`Table\`,
                        COLUMN_NAME AS \`Column\`,
                        DATA_TYPE AS \`Type\`,
                        IS_NULLABLE = 'YES' AS \`Nullable\`,
                        COLUMN_KEY = 'PRI' AS \`PK\`
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = COALESCE(NULLIF('${config.database || ''}', ''), DATABASE(), TABLE_SCHEMA)
                      AND TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
                    ORDER BY TABLE_NAME, ORDINAL_POSITION
                `;
                const fksQuery = `
                    SELECT 
                        TABLE_NAME AS \`Table\`,
                        COLUMN_NAME AS \`Column\`,
                        REFERENCED_TABLE_NAME AS \`ReferencedTable\`,
                        REFERENCED_COLUMN_NAME AS \`ReferencedColumn\`
                    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                    WHERE TABLE_SCHEMA = COALESCE(NULLIF('${config.database || ''}', ''), DATABASE(), TABLE_SCHEMA)
                      AND TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
                      AND REFERENCED_TABLE_NAME IS NOT NULL
                `;
                tablesResult = await dbProxy.query(tablesQuery);
                fksResult = await dbProxy.query(fksQuery);
            } else if (dialect === 'postgres') {
                const tablesQuery = `
                    SELECT 
                        t.table_schema AS "Schema",
                        t.table_name AS "Table",
                        c.column_name AS "Column",
                        c.data_type AS "Type",
                        c.is_nullable = 'YES' AS "Nullable",
                        EXISTS (
                            SELECT 1 FROM information_schema.key_column_usage kcu
                            JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
                            WHERE kcu.table_name = t.table_name AND kcu.column_name = c.column_name AND tc.constraint_type = 'PRIMARY KEY'
                        ) AS "PK"
                    FROM information_schema.tables t
                    JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
                    WHERE t.table_schema NOT IN ('information_schema', 'pg_catalog')
                      AND t.table_type = 'BASE TABLE'
                    ORDER BY t.table_name, c.ordinal_position
                `;
                const fksQuery = `
                    SELECT
                        tc.table_name AS "Table", 
                        kcu.column_name AS "Column", 
                        ccu.table_name AS "ReferencedTable",
                        ccu.column_name AS "ReferencedColumn" 
                    FROM information_schema.table_constraints AS tc 
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                      ON ccu.constraint_name = tc.constraint_name
                      AND ccu.table_schema = tc.table_schema
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                `;
                tablesResult = await dbProxy.query(tablesQuery);
                fksResult = await dbProxy.query(fksQuery);
            }

            return NextResponse.json({
                success: true,
                tables: tablesResult,
                relationships: fksResult
            });
        } finally {
            await dbProxy.close();
        }
    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: error.message || 'Failed to fetch ER data' },
            { status: 500 }
        );
    }
}
