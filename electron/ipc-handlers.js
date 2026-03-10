const { ipcMain, BrowserWindow, screen, app, safeStorage } = require('electron');
const { getDbProxy } = require('./db');

const isDev = !app.isPackaged;

function setupIpcHandlers() {
    // --- SAFE STORAGE HANDLERS ---
    ipcMain.handle('crypto:encrypt', async (event, text) => {
        try {
            if (!safeStorage.isEncryptionAvailable()) return text;
            const buffer = safeStorage.encryptString(text);
            return buffer.toString('base64');
        } catch (e) {
            return text;
        }
    });

    ipcMain.handle('crypto:decrypt', async (event, encryptedBase64) => {
        try {
            if (!safeStorage.isEncryptionAvailable()) return encryptedBase64;
            const buffer = Buffer.from(encryptedBase64, 'base64');
            return safeStorage.decryptString(buffer);
        } catch (e) {
            return encryptedBase64;
        }
    });

    // 0. Open new window (Multi-Window Support)
    ipcMain.handle('window:open', async (event, { url, title, width = 1200, height = 800 }) => {
        try {
            // Security Check: Ensure URL is internal
            if (url && !url.startsWith('/') && !url.startsWith('http://localhost') && !url.startsWith('app://')) {
                throw new Error('Unauthorized window URL');
            }

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
            console.error('[IPC] window:open error:', err.message);
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

            // --- SANITIZE ORDER BY ---
            let sanitizedOrderBy = null;
            if (orderBy) {
                // Allow only alphanumeric, underscores, dots and square brackets (for MSSQL)
                sanitizedOrderBy = orderBy.replace(/[^a-zA-Z0-9_.[\]]/g, '');
            }
            const sanitizedOrderDir = (orderDir === 'DESC' || orderDir === 'desc') ? 'DESC' : 'ASC';

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
                        const res = await dbProxy.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${queryToExec}`);
                        planData = Array.isArray(res) ? res : [res];
                    } else if (dialect === 'mysql' || dialect === 'mariadb') {
                        const res = await dbProxy.query(`EXPLAIN ${queryToExec}`);
                        planData = Array.isArray(res) ? res : [res];
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

                // Apply pagination logic for SINGLE SELECT queries only (skip for NoSQL)
                if (dialect !== 'mongodb' && dialect !== 'redis' && dialect !== 'kafka' && !isExplain && !isMultiStatement && isSelect && !queryToExec.toUpperCase().includes('OFFSET') && !queryToExec.toUpperCase().includes('LIMIT') && !queryToExec.toUpperCase().includes('GROUP BY')) {
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

                        if (sanitizedOrderBy) {
                            let cleanedQuery = baseQuery;
                            if (hasOrderBy) {
                                cleanedQuery = baseQuery.replace(/\s+ORDER\s+BY\s+[\w\.\[\]\d\s,]+$/i, '').trim();
                            }
                            finalQuery = `${cleanedQuery} ORDER BY ${sanitizedOrderBy} ${sanitizedOrderDir} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
                        } else if (hasOrderBy) {
                            finalQuery = `${baseQuery} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
                        } else {
                            finalQuery = `${baseQuery} ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
                        }
                    } else {
                        const hasOrderBy = /\s+ORDER\s+BY\s+[\w\.\[\]\d\s,]+$/i.test(baseQuery);
                        let cleanedQuery = baseQuery;
                        if (sanitizedOrderBy && hasOrderBy) {
                            cleanedQuery = baseQuery.replace(/\s+ORDER\s+BY\s+[\w\.\[\]\d\s,]+$/i, '').trim();
                        }
                        const sortClause = sanitizedOrderBy ? `ORDER BY ${sanitizedOrderBy} ${sanitizedOrderDir}` : '';
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
                if (dialect === 'mongodb') {
                    const collections = await dbProxy.query(JSON.stringify({ action: 'listCollections' }));
                    return {
                        success: true,
                        metadata: {
                            databases: [{ name: config.database || 'admin' }],
                            schemas: [{ name: 'public' }],
                            tables: Array.isArray(collections) ? collections.map(c => ({ name: c.name, schema: 'public', fullName: c.name })) : [],
                            views: [],
                            procedures: [],
                            synonyms: []
                        }
                    };
                } else if (dialect === 'redis') {
                    return {
                        success: true,
                        metadata: {
                            databases: [{ name: config.database || '0' }],
                            schemas: [],
                            tables: [{ name: 'Keys', schema: 'public', fullName: 'Keys' }],
                            views: [],
                            procedures: [],
                            synonyms: []
                        }
                    };
                } else if (dialect === 'kafka') {
                    const topicsResult = await dbProxy.query(JSON.stringify({ action: 'listTopics' }));
                    return {
                        success: true,
                        metadata: {
                            databases: [{ name: config.database || 'Kafka Cluster' }],
                            schemas: [{ name: 'topics' }],
                            tables: Array.isArray(topicsResult) ? topicsResult.map(t => ({ name: t.topic, schema: 'topics', fullName: t.topic })) : [],
                            views: [],
                            procedures: [],
                            synonyms: []
                        }
                    };
                } else if (dialect === 'mysql' || dialect === 'mariadb' || dialect === 'postgres') {
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

            const sanitizeIdentifier = (name) => name.replace(/[^a-zA-Z0-9_.[\]`"]/g, '');
            const safeTable = sanitizeIdentifier(table);
            const safeDatabase = sanitizeIdentifier(targetDb);

            const setClause = Object.entries(updates)
                .map(([col, val]) => {
                    const safeCol = sanitizeIdentifier(col);
                    const formattedVal = val === null ? 'NULL' : (typeof val === 'string' ? `'${val.replace(/'/g, dialect === 'mssql' ? "''" : (dialect === 'postgres' ? "''" : "\\'"))}'` : val);
                    return `${qStart}${safeCol}${qEnd} = ${formattedVal}`;
                }).join(', ');

            const whereClause = Object.entries(where)
                .map(([col, val]) => {
                    const safeCol = sanitizeIdentifier(col);
                    if (val === null) return `${qStart}${safeCol}${qEnd} IS NULL`;
                    const formattedVal = typeof val === 'string' ? `'${val.replace(/'/g, dialect === 'mssql' ? "''" : (dialect === 'postgres' ? "''" : "\\'"))}'` : val;
                    return `${qStart}${safeCol}${qEnd} = ${formattedVal}`;
                }).join(' AND ');

            const sql = dialect === 'mssql'
                ? `UPDATE [${safeDatabase}].${safeTable} SET ${setClause} WHERE ${whereClause}`
                : (dialect === 'postgres' ? `UPDATE "${safeTable}" SET ${setClause} WHERE ${whereClause}` : `UPDATE \`${safeDatabase}\`. \`${safeTable}\` SET ${setClause} WHERE ${whereClause}`);

            const dbProxy = await getDbProxy(config);
            try {
                const result = await dbProxy.query(sql);
                let rowsAffected = 0;
                if (result) {
                    if (dialect === 'mssql') {
                        if (result.rowsAffected && Array.isArray(result.rowsAffected)) {
                            rowsAffected = result.rowsAffected[0];
                        } else if (typeof result.rowsAffected === 'number') {
                            rowsAffected = result.rowsAffected;
                        }
                    } else if (dialect === 'postgres') {
                        rowsAffected = 1;
                    } else {
                        // MySQL/MariaDB
                        rowsAffected = result.affectedRows || 0;
                    }
                }

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
                if (dialect === 'mongodb' || dialect === 'redis') {
                    return {
                        success: true,
                        tables: [],
                        relationships: []
                    };
                }
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
                if (dialect === 'mongodb' || dialect === 'redis' || dialect === 'kafka') {
                    return { success: false, message: 'DDL is not supported for NoSQL / Streaming databases.' };
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

    // 7. Get Columns
    ipcMain.handle('db:columns', async (event, { config, table, schema }) => {
        try {
            const dialect = config.dbType || 'mssql';
            const dbProxy = await getDbProxy(config);
            try {
                if (dialect === 'mongodb' || dialect === 'redis' || dialect === 'kafka') {
                    return { success: true, columns: [] };
                }
                let query = '';
                if (dialect === 'mssql') {
                    const schemaPart = schema ? `AND TABLE_SCHEMA = '${schema.replace(/'/g, "''")}'` : '';
                    query = `SELECT COLUMN_NAME as name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table.replace(/'/g, "''")}' ${schemaPart} ORDER BY ORDINAL_POSITION`;
                } else if (dialect === 'postgres') {
                    const schemaPart = schema ? `AND table_schema = '${schema.replace(/'/g, "''")}'` : "AND table_schema NOT IN ('information_schema', 'pg_catalog')";
                    query = `SELECT column_name as name FROM information_schema.columns WHERE table_name = '${table.replace(/'/g, "''")}' ${schemaPart} ORDER BY ordinal_position`;
                } else {
                    const schemaPart = config.database ? `AND TABLE_SCHEMA = '${config.database.replace(/'/g, "''")}'` : '';
                    query = `SELECT COLUMN_NAME as name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table.replace(/'/g, "''")}' ${schemaPart} ORDER BY ORDINAL_POSITION`;
                }
                const result = await dbProxy.query(query);
                return { success: true, columns: result.map(col => col.name || col.COLUMN_NAME || col.column_name) };
            } finally {
                await dbProxy.close();
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // 8. Performance Data
    ipcMain.handle('db:performance', async (event, config) => {
        try {
            const dialect = config.dbType || 'mssql';
            const dbProxy = await getDbProxy(config);
            try {
                if (dialect === 'mssql') {
                    const missingIndexQuery = `SELECT TOP 20 migs.avg_total_user_cost * (migs.avg_user_impact / 100.0) * (migs.user_seeks + migs.user_scans) AS [weighted_impact], mid.[statement] AS [table_name], mid.equality_columns, mid.inequality_columns, mid.included_columns, migs.avg_user_impact FROM sys.dm_db_missing_index_groups AS mig JOIN sys.dm_db_missing_index_group_stats AS migs ON migs.group_handle = mig.index_group_handle JOIN sys.dm_db_missing_index_details AS mid ON mid.index_handle = mig.index_handle WHERE DB_ID(DB_NAME()) = mid.database_id ORDER BY weighted_impact DESC;`;
                    const expensiveQueriesQuery = `SELECT TOP 20 SUBSTRING(st.text, (qs.statement_start_offset/2) + 1, ((CASE statement_end_offset WHEN -1 THEN DATALENGTH(st.text) ELSE qs.statement_end_offset END - qs.statement_start_offset)/2) + 1) AS [query_text], qs.execution_count, qs.total_worker_time / 1000 AS [total_cpu_ms], qs.total_elapsed_time / 1000 AS [total_duration_ms] FROM sys.dm_exec_query_stats AS qs CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) AS st ORDER BY qs.total_worker_time DESC;`;
                    const recordsets = await dbProxy.query(`${missingIndexQuery}; ${expensiveQueriesQuery};`);
                    return { success: true, data: { missingIndexes: recordsets[0] || [], expensiveQueries: recordsets[1] || [] } };
                } else if (dialect === 'postgres') {
                    const missingIndexQuery = `SELECT relname AS table_name, seq_scan - idx_scan AS scan_diff, seq_scan, idx_scan FROM pg_stat_user_tables WHERE seq_scan > 0 ORDER BY seq_scan DESC LIMIT 20;`;
                    const expensiveQueriesQuery = `SELECT query as query_text, calls as execution_count, total_exec_time as total_duration_ms FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;`;
                    const missingIndexes = await dbProxy.query(missingIndexQuery);
                    let expensiveQueries = [];
                    try { expensiveQueries = await dbProxy.query(expensiveQueriesQuery); } catch (e) { }
                    return { success: true, data: { missingIndexes, expensiveQueries } };
                }
                return { success: false, message: `Advisor not supported for ${dialect} yet.` };
            } finally {
                await dbProxy.close();
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // 9. AI Test
    ipcMain.handle('ai:test', async (event, config) => {
        try {
            const { provider, apiKey, model, endpoint } = config;
            if (provider === 'openai') {
                const res = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': `Bearer ${apiKey}` } });
                if (res.ok) return { success: true, message: 'Connected to OpenAI!' };
                const data = await res.json();
                return { success: false, message: data.error?.message || 'Invalid API Key' };
            }
            if (provider === 'gemini') {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                if (res.ok) return { success: true, message: 'Gemini API key is valid!' };
                const data = await res.json();
                return { success: false, message: data.error?.message || 'Invalid API Key' };
            }
            if (provider === 'anthropic') {
                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
                    body: JSON.stringify({ model: model || 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] })
                });
                if (res.ok) return { success: true, message: 'Anthropic connection verified!' };
                const data = await res.json();
                return { success: false, message: data.error?.message || 'Invalid API Key' };
            }
            if (provider === 'zai') {
                const baseUrl = endpoint || 'https://api.z.ai/api/coding/paas/v4';
                const testUrl = baseUrl.endsWith('/models') ? baseUrl : `${baseUrl}/models`;
                const res = await fetch(testUrl, { headers: { 'Authorization': `Bearer ${apiKey}` } });
                if (res.ok) return { success: true, message: 'Z.ai PAAS v4 connected!' };
                return { success: false, message: 'Z.ai connection failed.' };
            }
            if (provider === 'ollama') {
                const baseUrl = endpoint || 'http://localhost:11434';
                const res = await fetch(`${baseUrl}/api/tags`);
                if (res.ok) return { success: true, message: 'Ollama is running!' };
                return { success: false, message: 'Could not reach Ollama.' };
            }
            return { success: false, message: 'Provider test not implemented in Electron yet.' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // 10. AI Generate
    ipcMain.handle('ai:generate', async (event, { prompt, schema, config, dbType }) => {
        try {
            const { provider, apiKey, model, endpoint } = config;

            // Generate Schema Context (Simplified version of lib/ai-utils.ts)
            let schemaContext = "DATABASE SCHEMA:\n";
            if (schema && schema.tables) {
                schema.tables.forEach(t => {
                    const cols = schema.columns?.filter(c => c.tableName === t.name && c.tableSchema === (t.schema || 'dbo')) || [];
                    schemaContext += `Table: ${t.name} [${cols.map(c => c.name).join(', ')}]\n`;
                });
            }

            const isMongo = dbType === 'mongodb';
            const isRedis = dbType === 'redis';
            const isKafka = dbType === 'kafka';

            let systemPrompt = '';
            if (isMongo) {
                systemPrompt = `Expert MongoDB Generator. Return valid JSON object only. Context:\n${schemaContext}`;
            } else if (isRedis) {
                systemPrompt = `Expert Redis Command Generator. Return raw command only (e.g., GET mykey).`;
            } else if (isKafka) {
                systemPrompt = `Expert Kafka Generator. Return valid JSON object only (e.g. {"action": "consume", "topic": "t1"}).`;
            } else {
                systemPrompt = `Expert SQL Generator for ${dbType || 'MSSQL'}. ONLY return SQL. No markdown. Schema:\n${schemaContext}`;
            }

            let url = '', headers = { 'Content-Type': 'application/json' }, body = {};

            if (provider === 'openai') {
                url = 'https://api.openai.com/v1/chat/completions';
                headers['Authorization'] = `Bearer ${apiKey}`;
                body = { model: model || 'gpt-4o', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }] };
            } else if (provider === 'zai') {
                const baseUrl = endpoint || 'https://api.z.ai/api/coding/paas/v4';
                url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
                headers['Authorization'] = `Bearer ${apiKey}`;
                body = { model: model || 'GLM-4.7', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }] };
            } else if (provider === 'ollama') {
                url = `${endpoint || 'http://localhost:11434'}/api/chat`;
                body = { model: model || 'llama3', stream: false, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }] };
            } else if (provider === 'gemini') {
                url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
                body = { contents: [{ parts: [{ text: `${systemPrompt}\n\nUSER PROMPT: ${prompt}` }] }] };
            } else if (provider === 'anthropic') {
                url = 'https://api.anthropic.com/v1/messages';
                headers['x-api-key'] = apiKey; headers['anthropic-version'] = '2023-06-01';
                body = { model: model || 'claude-3-5-sonnet-latest', max_tokens: 1024, messages: [{ role: 'user', content: `${systemPrompt}\n\nUSER PROMPT: ${prompt}` }] };
            }

            const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
            const data = await response.json();
            if (!response.ok) return { success: false, message: data.error?.message || 'AI Error' };

            let sql = '';
            if (provider === 'openai' || provider === 'zai') sql = data.choices[0]?.message?.content || '';
            else if (provider === 'ollama') sql = data.message?.content || '';
            else if (provider === 'gemini') sql = data.candidates[0]?.content?.parts[0]?.text || '';
            else if (provider === 'anthropic') sql = data.content[0]?.text || '';

            sql = sql.replace(/```sql\n?/gi, '').replace(/```\n?/g, '').trim();
            return { success: true, sql };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
}

module.exports = { setupIpcHandlers };
