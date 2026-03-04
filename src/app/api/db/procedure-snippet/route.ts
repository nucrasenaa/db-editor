import { NextRequest, NextResponse } from 'next/server';
import { getDbProxy } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { config, fullName, type, database } = await req.json();
        const dialect = config.dbType || 'mssql';
        const targetDb = database || config.database;

        if (type !== 'procedure') {
            return NextResponse.json({ success: false, message: 'Only procedures are supported' }, { status: 400 });
        }

        const dbProxy = await getDbProxy({ ...config, database: targetDb });

        try {
            let snippet = '';
            let params: any[] = [];

            if (dialect === 'mssql') {
                const query = `
                    SELECT name 
                    FROM sys.parameters 
                    WHERE object_id = OBJECT_ID(? ) 
                    ORDER BY parameter_id
                `.replace('?', `'[${targetDb}].${fullName}'`);

                params = await dbProxy.query(query) as any[];
                const paramList = params.map(p => `${p.name} = NULL`).join(', ');
                snippet = `EXEC ${fullName} ${paramList}`;
            } else if (dialect === 'mysql' || dialect === 'mariadb') {
                // Info schema params
                const [schema, name] = fullName.includes('.') ? fullName.split('.') : [targetDb, fullName];
                const query = `
                    SELECT PARAMETER_NAME as name 
                    FROM INFORMATION_SCHEMA.PARAMETERS 
                    WHERE SPECIFIC_SCHEMA = '${schema}' 
                    AND SPECIFIC_NAME = '${name}' 
                    AND ROUTINE_TYPE = 'PROCEDURE'
                    ORDER BY ORDINAL_POSITION
                `;
                params = await dbProxy.query(query) as any[];
                const paramList = params.filter(p => p.name).map(p => `NULL`).join(', ');
                snippet = `CALL ${fullName}(${paramList});`;
            } else if (dialect === 'postgres') {
                const [schema, name] = fullName.includes('.') ? fullName.split('.') : ['public', fullName];
                const query = `
                    SELECT parameter_name as name 
                    FROM information_schema.parameters 
                    WHERE specific_schema = '${schema}' 
                    AND specific_name LIKE '${name}%'
                    ORDER BY ordinal_position
                `;
                params = await dbProxy.query(query) as any[];
                const paramList = params.filter(p => p.name).map(p => `NULL`).join(', ');
                snippet = `CALL ${fullName}(${paramList});`;
            }

            return NextResponse.json({
                success: true,
                snippet: snippet
            });
        } finally {
            await dbProxy.close();
        }
    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: error.message || 'Failed to fetch procedure snippet' },
            { status: 500 }
        );
    }
}
