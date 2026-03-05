import { NextRequest, NextResponse } from 'next/server';
import { getDbProxy } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { config, query, page = 1, pageSize = 100, orderBy, orderDir = 'ASC', includeCount = false } = await req.json();
        const dialect = config.dbType || 'mssql';

        if (!query) {
            return NextResponse.json({ success: false, message: 'Query is required' }, { status: 400 });
        }

        const actualQuery = query.trim();
        const isExplain = actualQuery.startsWith('EXPLAIN_PLAN:');
        const queryToExec = isExplain ? actualQuery.replace('EXPLAIN_PLAN:', '').trim() : actualQuery;
        const isSelect = queryToExec.toUpperCase().startsWith('SELECT');

        let finalQuery = queryToExec;
        let totalRows = 0;

        const dbProxy = await getDbProxy(config);

        try {
            if (isExplain) {
                let planData: any = [];
                let actualData: any = [];

                if (dialect === 'mssql') {
                    // Combine into a single batch to ensure session state for STATISTICS PROFILE
                    const results = await dbProxy.query(`SET STATISTICS PROFILE ON;\n${queryToExec};\nSET STATISTICS PROFILE OFF;`);
                    const hasMultipleSets = Array.isArray(results) && results.length > 1;
                    planData = hasMultipleSets ? results[1] : (Array.isArray(results) ? results[0] : []);
                    actualData = hasMultipleSets ? results[0] : [];
                } else if (dialect === 'postgres') {
                    // Postgres explain
                    planData = await dbProxy.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${queryToExec}`);
                } else if (dialect === 'mysql' || dialect === 'mariadb') {
                    // MySQL explain
                    planData = await dbProxy.query(`EXPLAIN ${queryToExec}`);
                }

                return NextResponse.json({
                    success: true,
                    data: actualData,
                    executionPlan: planData,
                    totalRows: actualData.length,
                    columns: actualData.length > 0 ? Object.keys(actualData[0]) : [],
                    page,
                    pageSize
                });
            }

            const isMultiStatement = queryToExec.trim().split(';').filter((s: string) => s.trim().length > 0).length > 1;

            // Apply pagination logic for SINGLE SELECT queries only
            if (!isExplain && !isMultiStatement && isSelect && !queryToExec.toUpperCase().includes('OFFSET') && !queryToExec.toUpperCase().includes('LIMIT') && !queryToExec.toUpperCase().includes('GROUP BY')) {
                const offset = (page - 1) * pageSize;

                // Clean up base query
                let baseQuery = queryToExec.replace(/;$/, '');
                if (dialect === 'mssql') {
                    baseQuery = baseQuery.replace(/SELECT\s+TOP\s+\d+/i, 'SELECT');
                } else {
                    baseQuery = baseQuery.replace(/LIMIT\s+\d+/i, '');
                    baseQuery = baseQuery.replace(/LIMIT\s+\d+,\s*\d+/i, '');
                }

                // Get total count if requested or on first load
                if (includeCount) {
                    const fromMatch = baseQuery.match(/FROM/i);
                    if (fromMatch && fromMatch.index !== undefined) {
                        const fromPart = baseQuery.substring(fromMatch.index);
                        const countSql = `SELECT COUNT(*) as total ${fromPart}`;
                        try {
                            const countResult = await dbProxy.query(countSql);
                            // PostgreSQL count result is nested in an array of objects
                            totalRows = (Array.isArray(countResult) ? parseInt(countResult[0]?.total || 0) : parseInt(countResult.total || 0)) || 0;
                        } catch (e) {
                            console.error('Count query failed', e);
                        }
                    }
                }

                if (dialect === 'mssql') {
                    // Check if query already has an ORDER BY clause at the end
                    // This avoids double ORDER BY which is invalid in MSSQL
                    const hasOrderBy = /\s+ORDER\s+BY\s+[\w\.\[\]\d\s,]+$/i.test(baseQuery);

                    if (orderBy) {
                        // If we have explicit sort params, strip any existing ORDER BY to avoid duplication
                        let cleanedQuery = baseQuery;
                        if (hasOrderBy) {
                            cleanedQuery = baseQuery.replace(/\s+ORDER\s+BY\s+[\w\.\[\]\d\s,]+$/i, '').trim();
                        }
                        finalQuery = `${cleanedQuery} ORDER BY ${orderBy} ${orderDir} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
                    } else if (hasOrderBy) {
                        // Use existing ORDER BY if present
                        finalQuery = `${baseQuery} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
                    } else {
                        // No ORDER BY found, add a dummy one required for OFFSET/FETCH in MSSQL
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
            // Case 1: results is [[...], [...]]
            const isMultiSet = Array.isArray(results) && results.length > 1 && Array.isArray(results[0]);

            if (isMultiSet) {
                const resultSets = (results as any[]).map(set => ({
                    data: set,
                    columns: set.length > 0 ? Object.keys(set[0]) : [],
                    totalRows: set.length
                }));

                return NextResponse.json({
                    success: true,
                    isMultiSet: true,
                    resultSets,
                    page,
                    pageSize
                });
            }

            const rows = Array.isArray(results) ? results : [results].filter(Boolean);

            return NextResponse.json({
                success: true,
                isMultiSet: false,
                data: rows,
                totalRows: totalRows || rows.length,
                columns: rows.length > 0 ? Object.keys(rows[0]) : [],
                page,
                pageSize
            });
        } finally {
            await dbProxy.close();
        }
    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: error.message || 'Query execution failed' },
            { status: 500 }
        );
    }
}
