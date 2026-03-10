import { NextRequest, NextResponse } from 'next/server';
import { getDbProxy } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { dbType, table, schema, ...config } = await req.json();

        if (!table) {
            return NextResponse.json({ success: false, message: 'Table name is required' }, { status: 400 });
        }

        const dialect = dbType || 'mssql';
        const dbProxy = await getDbProxy({ ...config, dbType: dialect });

        try {
            if (dialect === 'mongodb' || dialect === 'redis') {
                return NextResponse.json({
                    success: true,
                    columns: []
                });
            }

            // General query that works on most SQL dialects via INFORMATION_SCHEMA
            let query = '';

            if (dialect === 'mssql') {
                const schemaPart = schema ? `AND TABLE_SCHEMA = '${schema.replace(/'/g, "''")}'` : '';
                query = `
                    SELECT 
                        COLUMN_NAME as name, 
                        DATA_TYPE as dataType, 
                        IS_NULLABLE as isNullable,
                        CHARACTER_MAXIMUM_LENGTH as maxLength
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = '${table.replace(/'/g, "''")}'
                    ${schemaPart}
                    ORDER BY ORDINAL_POSITION
                `;
            } else if (dialect === 'postgres') {
                const schemaPart = schema ? `AND table_schema = '${schema.replace(/'/g, "''")}'` : "AND table_schema NOT IN ('information_schema', 'pg_catalog')";
                query = `
                    SELECT 
                        column_name as name, 
                        data_type as "dataType", 
                        is_nullable as "isNullable",
                        character_maximum_length as "maxLength"
                    FROM information_schema.columns
                    WHERE table_name = '${table.replace(/'/g, "''")}'
                    ${schemaPart}
                    ORDER BY ordinal_position
                `;
            } else {
                // MySQL / MariaDB
                const schemaPart = config.database ? `AND TABLE_SCHEMA = '${config.database.replace(/'/g, "''")}'` : '';
                query = `
                    SELECT 
                        COLUMN_NAME as name, 
                        DATA_TYPE as dataType, 
                        IS_NULLABLE as isNullable,
                        CHARACTER_MAXIMUM_LENGTH as maxLength
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = '${table.replace(/'/g, "''")}'
                    ${schemaPart}
                    ORDER BY ORDINAL_POSITION
                `;
            }

            const result = await dbProxy.query(query) as any[];

            return NextResponse.json({
                success: true,
                columns: result.map(col => col.name || col.COLUMN_NAME)
            });
        } finally {
            await dbProxy.close();
        }
    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: error.message || 'Failed to fetch columns' },
            { status: 500 }
        );
    }
}
