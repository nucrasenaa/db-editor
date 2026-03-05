const { ipcMain, BrowserWindow, screen, app } = require('electron');
const { getDbProxy } = require('./db');

const isDev = !app.isPackaged;

function setupIpcHandlers() {
    // 0. Open new window (Multi-Window Support)
    ipcMain.handle('window:open', async (event, { url, title, width = 1200, height = 800 }) => {
        try {
            const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
            const win = new BrowserWindow({
                width: Math.min(width, sw),
                height: Math.min(height, sh),
                title: title || 'Data Forge',
                backgroundColor: '#0f172a',
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: require('path').join(__dirname, 'preload.js'),
                },
                show: false,
            });

            const fullUrl = isDev
                ? `http://localhost:3000${url}`
                : `app://local${url}`;

            win.loadURL(fullUrl);
            win.once('ready-to-show', () => win.show());
            return { success: true };
        } catch (err) {
            return { success: false, message: err.message };
        }
    });

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

            const actualQuery = query.trim();
            const isExplain = actualQuery.startsWith('EXPLAIN_PLAN:');
            const queryToExec = isExplain ? actualQuery.replace('EXPLAIN_PLAN:', '').trim() : actualQuery;
            const isSelect = queryToExec.toUpperCase().startsWith('SELECT');

            let finalQuery = queryToExec;
            let totalRows = 0;

            const dbProxy = await getDbProxy(config);
            try {
                if (isExplain) {
                    let planData = [];
                    let actualData = [];

                    if (dialect === 'mssql') {
                        // Combine into a single batch to ensure session state for STATISTICS PROFILE
                        const results = await dbProxy.query(`SET STATISTICS PROFILE ON;\n${queryToExec};\nSET STATISTICS PROFILE OFF;`);
                        const hasMultipleSets = Array.isArray(results) && results.length > 1;
                        planData = hasMultipleSets ? results[1] : (Array.isArray(results) ? results[0] : []);
                        actualData = hasMultipleSets ? results[0] : [];
                    } else if (dialect === 'postgres') {
                        planData = await dbProxy.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${queryToExec}`);
                    } else if (dialect === 'mysql' || dialect === 'mariadb') {
                        planData = await dbProxy.query(`EXPLAIN ${queryToExec}`);
                    }

                    return {
                        success: true,
                        data: actualData,
                        executionPlan: planData,
                        totalRows: actualData.length,
                        columns: actualData.length > 0 ? Object.keys(actualData[0]) : [],
                        page,
                        pageSize
                    };
                }

                const isMultiStatement = queryToExec.trim().split(';').filter(s => s.trim().length > 0).length > 1;

                // Apply pagination logic for SINGLE SELECT queries only
                if (!isExplain && !isMultiStatement && isSelect && !queryToExec.toUpperCase().includes('OFFSET') && !queryToExec.toUpperCase().includes('LIMIT') && !queryToExec.toUpperCase().includes('GROUP BY')) {
                    const offset = (page - 1) * pageSize;
                    let baseQuery = queryToExec.replace(/;$/, '');
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
                        // Check if query already has an ORDER BY clause at the end
                        const hasOrderBy = /\s+ORDER\s+BY\s+[\w\.\[\]\d\s,]+$/i.test(baseQuery);

                        if (orderBy) {
                            let cleanedQuery = baseQuery;
                            if (hasOrderBy) {
                                cleanedQuery = baseQuery.replace(/\s+ORDER\s+BY\s+[\w\.\[\]\d\s,]+$/i, '').trim();
                            }
                            finalQuery = `${cleanedQuery} ORDER BY ${orderBy} ${orderDir} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
                        } else if (hasOrderBy) {
                            finalQuery = `${baseQuery} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
                        } else {
                            finalQuery = `${baseQuery} ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
                        }
                    } else {
                        const hasOrderBy = /\s+ORDER\s+BY\s+[\w\.\[\]\d\s,]+$/i.test(baseQuery);
                        let cleanedQuery = baseQuery;
                        if (orderBy && hasOrderBy) {
                            cleanedQuery = baseQuery.replace(/\s+ORDER\s+BY\s+[\w\.\[\]\d\s,]+$/i, '').trim();
                        }
                        const sortClause = orderBy ? `ORDER BY ${orderBy} ${orderDir}` : '';
                        finalQuery = `${cleanedQuery} ${sortClause} LIMIT ${pageSize} OFFSET ${offset}`;
                    }
                }

                const results = await dbProxy.query(finalQuery);

                // Detect if results is an array of recordsets (multi-result set)
                const isMultiSet = Array.isArray(results) && results.length > 1 && Array.isArray(results[0]);

                if (isMultiSet) {
                    const resultSets = results.map(set => ({
                        data: set,
                        columns: set.length > 0 ? Object.keys(set[0]) : [],
                        totalRows: set.length
                    }));

                    return {
                        success: true,
                        isMultiSet: true,
                        resultSets,
                        page,
                        pageSize
                    };
                }

                const rows = Array.isArray(results) ? results : [results].filter(Boolean);

                return {
                    success: true,
                    isMultiSet: false,
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

    // 5. ER Diagram Data
    ipcMain.handle('db:erd', async (event, config) => {
        try {
            const dialect = config.dbType || 'mssql';
            const dbProxy = await getDbProxy(config);
            try {
                let tablesResult = [];
                let fksResult = [];

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

                return {
                    success: true,
                    tables: tablesResult,
                    relationships: fksResult
                };
            } finally {
                await dbProxy.close();
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // 6. Procedure Snippet
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

    // 6. Get DDL (Create Script)
    ipcMain.handle('db:get-ddl', async (event, { config, fullName, type, database }) => {
        try {
            const dialect = config.dbType || 'mssql';
            const targetDb = database || config.database;
            const dbProxy = await getDbProxy({ ...config, database: targetDb });
            try {
                let script = '';
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
                        script += cols.map(c => `  [${c.name}] ${c.type.toUpperCase()}${c.max_length > 0 ? `(${c.max_length})` : ''} ${c.is_nullable ? 'NULL' : 'NOT NULL'}${c.is_pk ? ' PRIMARY KEY' : ''}`).join(',\n');
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
                return { success: true, script };
            } finally {
                await dbProxy.close();
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
}

module.exports = { setupIpcHandlers };
