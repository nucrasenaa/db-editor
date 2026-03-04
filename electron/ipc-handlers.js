const { ipcMain } = require('electron');
const { getDbProxy } = require('./db');

function setupIpcHandlers() {
    // 1. Test Connection
    ipcMain.handle('db:test', async (event, config) => {
        try {
            const dbProxy = await getDbProxy(config);
            await dbProxy.close();
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // 2. Query
    ipcMain.handle('db:query', async (event, { config, query, page = 1, pageSize = 100, orderBy, orderDir = 'ASC', includeCount = false }) => {
        try {
            const dialect = config.dbType || 'mssql';
            if (!query) throw new Error('Query is required');

            const trimmedQuery = query.trim();
            const isSelect = trimmedQuery.toUpperCase().startsWith('SELECT');
            let finalQuery = trimmedQuery;
            let totalRows = 0;

            const dbProxy = await getDbProxy(config);
            try {
                if (isSelect && !trimmedQuery.toUpperCase().includes('OFFSET') && !trimmedQuery.toUpperCase().includes('LIMIT') && !trimmedQuery.toUpperCase().includes('GROUP BY')) {
                    const offset = (page - 1) * pageSize;
                    let baseQuery = trimmedQuery.replace(/;$/, '');
                    if (dialect === 'mssql') {
                        baseQuery = baseQuery.replace(/SELECT\s+TOP\s+\d+/i, 'SELECT');
                    } else {
                        baseQuery = baseQuery.replace(/LIMIT\s+\d+/i, '');
                    }

                    if (includeCount) {
                        const fromMatch = baseQuery.match(/FROM/i);
                        if (fromMatch) {
                            const fromPart = baseQuery.substring(fromMatch.index);
                            const countSql = `SELECT COUNT(*) as total ${fromPart}`;
                            try {
                                const countResult = await dbProxy.query(countSql);
                                totalRows = (Array.isArray(countResult) ? parseInt(countResult[0]?.total || 0) : parseInt(countResult.total || 0)) || 0;
                            } catch (e) { }
                        }
                    }

                    if (dialect === 'mssql') {
                        const sortClause = orderBy ? `ORDER BY ${orderBy} ${orderDir}` : 'ORDER BY (SELECT NULL)';
                        finalQuery = `${baseQuery} ${sortClause} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
                    } else {
                        const sortClause = orderBy ? `ORDER BY ${orderBy} ${orderDir}` : '';
                        finalQuery = `${baseQuery} ${sortClause} LIMIT ${pageSize} OFFSET ${offset}`;
                    }
                }

                const data = await dbProxy.query(finalQuery);
                const rows = Array.isArray(data) ? data : [data].filter(Boolean);

                return {
                    success: true,
                    data: rows,
                    totalRows: totalRows || rows.length,
                    columns: rows.length > 0 ? Object.keys(rows[0]) : [],
                    page,
                    pageSize
                };
            } finally {
                await dbProxy.close();
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // 3. Metadata
    ipcMain.handle('db:metadata', async (event, config) => {
        try {
            const dialect = config.dbType || 'mssql';
            const dbProxy = await getDbProxy(config);
            try {
                if (dialect === 'mysql' || dialect === 'mariadb' || dialect === 'postgres') {
                    const queries = dialect === 'postgres' ? {
                        databases: `SELECT datname as name FROM pg_database WHERE datistemplate = false AND datname != 'postgres'`,
                        schemas: `SELECT schema_name as name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog')`,
                        tables: `SELECT table_name as name, table_schema as schema, CONCAT(table_schema, '.', table_name) as "fullName" FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('information_schema', 'pg_catalog')`,
                        views: `SELECT table_name as name, table_schema as schema, CONCAT(table_schema, '.', table_name) as "fullName" FROM information_schema.views WHERE table_schema NOT IN ('information_schema', 'pg_catalog')`,
                        procedures: `SELECT routine_name as name, routine_schema as schema, CONCAT(routine_schema, '.', routine_name) as "fullName" FROM information_schema.routines WHERE routine_type = 'PROCEDURE' AND routine_schema NOT IN ('information_schema', 'pg_catalog')`,
                        synonyms: `SELECT NULL as "fullName" LIMIT 0`
                    } : {
                        databases: `SHOW DATABASES`,
                        schemas: `SELECT SCHEMA_NAME as name FROM INFORMATION_SCHEMA.SCHEMATA`,
                        tables: `SELECT TABLE_NAME as name, TABLE_SCHEMA as \`schema\`, CONCAT(TABLE_SCHEMA, '.', TABLE_NAME) as fullName FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')`,
                        views: `SELECT TABLE_NAME as name, TABLE_SCHEMA as \`schema\`, CONCAT(TABLE_SCHEMA, '.', TABLE_NAME) as fullName FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')`,
                        procedures: `SELECT ROUTINE_NAME as name, ROUTINE_SCHEMA as \`schema\`, CONCAT(ROUTINE_SCHEMA, '.', ROUTINE_NAME) as fullName FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_TYPE = 'PROCEDURE' AND ROUTINE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')`,
                        synonyms: `SELECT NULL as fullName LIMIT 0`
                    };

                    const dbList = await dbProxy.query(queries.databases);
                    const schemas = await dbProxy.query(queries.schemas);
                    const tables = await dbProxy.query(queries.tables);
                    const views = await dbProxy.query(queries.views);
                    const procedures = await dbProxy.query(queries.procedures);
                    const synonyms = await dbProxy.query(queries.synonyms);

                    return {
                        success: true,
                        metadata: {
                            databases: dbList.map(db => ({ name: db.name || db.Database || db.SCHEMA_NAME || db.datname })),
                            schemas: schemas.map(s => ({ name: s.name })),
                            tables: tables.map(t => ({ name: t.name, schema: t.schema, fullName: t.fullName })),
                            views: views.map(v => ({ name: v.name, schema: v.schema, fullName: v.fullName })),
                            procedures: procedures.map(p => ({ name: p.name, schema: p.schema, fullName: p.fullName })),
                            synonyms: synonyms
                        }
                    };
                } else {
                    const queries = {
                        databases: `SELECT name FROM sys.databases WHERE state_desc = 'ONLINE' ORDER BY name`,
                        schemas: `SELECT name FROM sys.schemas WHERE name NOT IN ('sys', 'information_schema') ORDER BY name`,
                        tables: `SELECT QUOTENAME(s.name) + '.' + QUOTENAME(t.name) as fullName, s.name as [schema], t.name as [name] FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id ORDER BY s.name, t.name`,
                        views: `SELECT QUOTENAME(s.name) + '.' + QUOTENAME(v.name) as fullName, s.name as [schema], v.name as [name] FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id ORDER BY s.name, v.name`,
                        procedures: `SELECT QUOTENAME(s.name) + '.' + QUOTENAME(p.name) as fullName, s.name as [schema], p.name as [name] FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id ORDER BY s.name, p.name`,
                        synonyms: `SELECT QUOTENAME(s.name) + '.' + QUOTENAME(sn.name) as fullName, s.name as [schema], sn.name as [name] FROM sys.synonyms sn JOIN sys.schemas s ON sn.schema_id = s.schema_id ORDER BY s.name, sn.name`
                    };
                    const combinedQuery = `${queries.databases};${queries.schemas};${queries.tables};${queries.views};${queries.procedures};${queries.synonyms};`;
                    const recordsets = await dbProxy.query(combinedQuery);
                    return {
                        success: true,
                        metadata: {
                            databases: recordsets[0],
                            schemas: recordsets[1],
                            tables: recordsets[2],
                            views: recordsets[3],
                            procedures: recordsets[4],
                            synonyms: recordsets[5]
                        }
                    };
                }
            } finally {
                await dbProxy.close();
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // 4. Update
    ipcMain.handle('db:update', async (event, { config, table, database, updates, where }) => {
        try {
            const dialect = config.dbType || 'mssql';
            const targetDb = database || config.database;
            const qStart = dialect === 'mssql' ? '[' : (dialect === 'postgres' ? '"' : '`');
            const qEnd = dialect === 'mssql' ? ']' : (dialect === 'postgres' ? '"' : '`');

            const setClause = Object.entries(updates)
                .map(([col, val]) => {
                    const formattedVal = val === null ? 'NULL' : (typeof val === 'string' ? `'${val.replace(/'/g, dialect === 'mssql' ? "''" : (dialect === 'postgres' ? "''" : "\\'"))}'` : val);
                    return `${qStart}${col}${qEnd} = ${formattedVal}`;
                }).join(', ');

            const whereClause = Object.entries(where)
                .map(([col, val]) => {
                    if (val === null) return `${qStart}${col}${qEnd} IS NULL`;
                    const formattedVal = typeof val === 'string' ? `'${val.replace(/'/g, dialect === 'mssql' ? "''" : (dialect === 'postgres' ? "''" : "\\'"))}'` : val;
                    return `${qStart}${col}${qEnd} = ${formattedVal}`;
                }).join(' AND ');

            const sql = dialect === 'mssql'
                ? `UPDATE [${targetDb}].${table} SET ${setClause} WHERE ${whereClause}`
                : (dialect === 'postgres' ? `UPDATE "${table}" SET ${setClause} WHERE ${whereClause}` : `UPDATE \`${targetDb}\`. \`${table}\` SET ${setClause} WHERE ${whereClause}`);

            const dbProxy = await getDbProxy(config);
            try {
                const result = await dbProxy.query(sql);
                let rowsAffected = 0;
                if (dialect === 'mssql') rowsAffected = result.rowsAffected ? result.rowsAffected[0] : 0;
                else if (dialect === 'postgres') rowsAffected = 1;
                else rowsAffected = result.affectedRows || 0;

                return { success: true, rowsAffected };
            } finally {
                await dbProxy.close();
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // 5. Procedure Snippet
    ipcMain.handle('db:procedure-snippet', async (event, { config, fullName, type, database }) => {
        try {
            const dialect = config.dbType || 'mssql';
            const targetDb = database || config.database;
            const dbProxy = await getDbProxy({ ...config, database: targetDb });
            try {
                let snippet = '';
                if (dialect === 'mssql') {
                    const query = `SELECT name FROM sys.parameters WHERE object_id = OBJECT_ID('[${targetDb}].${fullName}') ORDER BY parameter_id`;
                    const params = await dbProxy.query(query);
                    snippet = `EXEC ${fullName} ${params.map(p => `${p.name} = NULL`).join(', ')}`;
                } else if (dialect === 'mysql' || dialect === 'mariadb') {
                    const [schema, name] = fullName.includes('.') ? fullName.split('.') : [targetDb, fullName];
                    const query = `SELECT PARAMETER_NAME FROM INFORMATION_SCHEMA.PARAMETERS WHERE SPECIFIC_SCHEMA = '${schema}' AND SPECIFIC_NAME = '${name}' AND ROUTINE_TYPE = 'PROCEDURE' ORDER BY ORDINAL_POSITION`;
                    const params = await dbProxy.query(query);
                    snippet = `CALL ${fullName}(${params.filter(p => p.PARAMETER_NAME).map(() => 'NULL').join(', ')});`;
                } else if (dialect === 'postgres') {
                    const [schema, name] = fullName.includes('.') ? fullName.split('.') : ['public', fullName];
                    const query = `SELECT parameter_name FROM information_schema.parameters WHERE specific_schema = '${schema}' AND specific_name LIKE '${name}%' ORDER BY ordinal_position`;
                    const params = await dbProxy.query(query);
                    snippet = `CALL ${fullName}(${params.filter(p => p.parameter_name).map(() => 'NULL').join(', ')});`;
                }
                return { success: true, snippet };
            } finally {
                await dbProxy.close();
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
}

module.exports = { setupIpcHandlers };
