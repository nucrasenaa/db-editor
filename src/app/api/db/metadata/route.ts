import { NextRequest, NextResponse } from 'next/server';
import { getDbProxy } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { dbType, ...config } = await req.json();
        const targetDb = config.database;
        const dialect = dbType || 'mssql';

        const dbProxy = await getDbProxy({ ...config, dbType: dialect });

        try {
            if (dialect === 'mongodb') {
                const collections = await dbProxy.query(JSON.stringify({ action: 'listCollections' }));
                return NextResponse.json({
                    success: true,
                    database: targetDb,
                    metadata: {
                        databases: [{ name: targetDb || 'admin' }],
                        schemas: [{ name: 'public' }],
                        tables: Array.isArray(collections) ? collections.map((c: any) => ({ name: c.name, schema: 'public', fullName: c.name })) : [],
                        views: [],
                        procedures: [],
                        synonyms: []
                    }
                });
            } else if (dialect === 'redis') {
                return NextResponse.json({
                    success: true,
                    database: targetDb || '0',
                    metadata: {
                        databases: [{ name: targetDb || '0' }],
                        schemas: [],
                        tables: [{ name: 'Keys', schema: 'public', fullName: 'Keys' }],
                        views: [],
                        procedures: [],
                        synonyms: []
                    }
                });
            } else if (dialect === 'kafka') {
                const topicsResult = await dbProxy.query(JSON.stringify({ action: 'listTopics' }));
                return NextResponse.json({
                    success: true,
                    database: targetDb || 'Kafka Cluster',
                    metadata: {
                        databases: [{ name: targetDb || 'Kafka Cluster' }],
                        schemas: [{ name: 'topics' }],
                        tables: Array.isArray(topicsResult) ? topicsResult.map((t: any) => ({ name: t.topic, schema: 'topics', fullName: t.topic })) : [],
                        views: [],
                        procedures: [],
                        synonyms: []
                    }
                });
            } else if (dialect === 'mysql' || dialect === 'mariadb' || dialect === 'postgres') {
                const queries = dialect === 'postgres' ? {
                    databases: `SELECT datname as name FROM pg_database WHERE datistemplate = false AND datname != 'postgres'`,
                    schemas: `SELECT schema_name as name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog')`,
                    tables: `SELECT table_name as name, table_schema as schema, CONCAT(table_schema, '.', table_name) as "fullName" 
                             FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('information_schema', 'pg_catalog')`,
                    views: `SELECT table_name as name, table_schema as schema, CONCAT(table_schema, '.', table_name) as "fullName" 
                            FROM information_schema.views WHERE table_schema NOT IN ('information_schema', 'pg_catalog')`,
                    procedures: `SELECT routine_name as name, routine_schema as schema, CONCAT(routine_schema, '.', routine_name) as "fullName" 
                                 FROM information_schema.routines WHERE routine_type = 'PROCEDURE' AND routine_schema NOT IN ('information_schema', 'pg_catalog')`,
                    synonyms: `SELECT NULL as "fullName" LIMIT 0`
                } : {
                    databases: `SHOW DATABASES`,
                    schemas: `SELECT SCHEMA_NAME as name FROM INFORMATION_SCHEMA.SCHEMATA`,
                    tables: `SELECT TABLE_NAME as name, TABLE_SCHEMA as \`schema\`, CONCAT(TABLE_SCHEMA, '.', TABLE_NAME) as fullName 
                             FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')`,
                    views: `SELECT TABLE_NAME as name, TABLE_SCHEMA as \`schema\`, CONCAT(TABLE_SCHEMA, '.', TABLE_NAME) as fullName 
                            FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')`,
                    procedures: `SELECT ROUTINE_NAME as name, ROUTINE_SCHEMA as \`schema\`, CONCAT(ROUTINE_SCHEMA, '.', ROUTINE_NAME) as fullName 
                                 FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE' AND ROUTINE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')`,
                    synonyms: `SELECT NULL as fullName LIMIT 0`
                };

                const dbList = await dbProxy.query(queries.databases) as any[];
                const schemas = await dbProxy.query(queries.schemas) as any[];
                const tables = await dbProxy.query(queries.tables) as any[];
                const views = await dbProxy.query(queries.views) as any[];
                const procedures = await dbProxy.query(queries.procedures) as any[];
                const synonyms = await dbProxy.query(queries.synonyms) as any[];

                return NextResponse.json({
                    success: true,
                    database: targetDb,
                    metadata: {
                        databases: dbList.map(db => ({ name: db.name || db.Database || db.SCHEMA_NAME || db.datname })),
                        schemas: schemas.map(s => ({ name: s.name })),
                        tables: tables.map(t => ({ name: t.name, schema: t.schema, fullName: t.fullName })),
                        views: views.map(v => ({ name: v.name, schema: v.schema, fullName: v.fullName })),
                        procedures: procedures.map(p => ({ name: p.name, schema: p.schema, fullName: p.fullName })),
                        synonyms: synonyms
                    }
                });
            } else {
                // MSSQL Logic
                const queries = {
                    databases: `SELECT name FROM sys.databases WHERE state_desc = 'ONLINE' ORDER BY name`,
                    schemas: `SELECT name FROM sys.schemas WHERE name NOT IN ('sys', 'information_schema') ORDER BY name`,
                    tables: `SELECT QUOTENAME(s.name) + '.' + QUOTENAME(t.name) as fullName, s.name as [schema], t.name as [name] 
                       FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id ORDER BY s.name, t.name`,
                    views: `SELECT QUOTENAME(s.name) + '.' + QUOTENAME(v.name) as fullName, s.name as [schema], v.name as [name] 
                      FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id ORDER BY s.name, v.name`,
                    procedures: `SELECT QUOTENAME(s.name) + '.' + QUOTENAME(p.name) as fullName, s.name as [schema], p.name as [name] 
                           FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id ORDER BY s.name, p.name`,
                    synonyms: `SELECT QUOTENAME(s.name) + '.' + QUOTENAME(sn.name) as fullName, s.name as [schema], sn.name as [name] 
                         FROM sys.synonyms sn JOIN sys.schemas s ON sn.schema_id = s.schema_id ORDER BY s.name, sn.name`
                };

                const combinedQuery = `
                    ${queries.databases};
                    ${queries.schemas};
                    ${queries.tables};
                    ${queries.views};
                    ${queries.procedures};
                    ${queries.synonyms};
                `;

                const recordsets = await dbProxy.query(combinedQuery) as any[];

                return NextResponse.json({
                    success: true,
                    database: targetDb,
                    metadata: {
                        databases: recordsets[0],
                        schemas: recordsets[1],
                        tables: recordsets[2],
                        views: recordsets[3],
                        procedures: recordsets[4],
                        synonyms: recordsets[5]
                    }
                });
            }
        } finally {
            await dbProxy.close();
        }
    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: error.message || 'Failed to fetch metadata' },
            { status: 500 }
        );
    }
}
