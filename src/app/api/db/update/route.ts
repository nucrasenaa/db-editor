import { NextRequest, NextResponse } from 'next/server';
import { getDbProxy } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { config, table, database, updates, where } = await req.json();
        const dialect = config.dbType || 'mssql';

        if (!table || !updates || !where) {
            return NextResponse.json({ success: false, message: 'Missing required update parameters' }, { status: 400 });
        }

        const targetDb = database || config.database;
        const qStart = dialect === 'mssql' ? '[' : (dialect === 'postgres' ? '"' : '`');
        const qEnd = dialect === 'mssql' ? ']' : (dialect === 'postgres' ? '"' : '`');

        // Helper to format values for SQL based on dialect
        const formatVal = (val: any) => {
            if (val === null) return 'NULL';
            if (typeof val === 'number' || typeof val === 'boolean') return val;
            // Dates or strings
            const str = String(val);
            const escaped = str.replace(/'/g, dialect === 'mssql' ? "''" : (dialect === 'postgres' ? "''" : "''")); // mysql2 often prefers '' for literals too
            return `'${escaped}'`;
        };

        // Construct SET clause
        const setClause = Object.entries(updates)
            .map(([col, val]) => `${qStart}${col}${qEnd} = ${formatVal(val)}`)
            .join(', ');

        // Construct WHERE clause - prioritizing id/ID/uuid
        const whereEntries = Object.entries(where);
        const idCol = whereEntries.find(([col]) => ['id', 'ID', 'uuid', 'guid', 'pk', 'UID'].includes(col.toLowerCase()));

        let finalWhere = '';
        if (idCol) {
            // If we have an ID column, use just that as it's the safest way to target the row
            finalWhere = `${qStart}${idCol[0]}${qEnd} = ${formatVal(idCol[1])}`;
        } else {
            // Fallback: use all non-complex columns
            finalWhere = whereEntries
                .filter(([_, val]) => typeof val !== 'object' || val === null) // skip blobs/objects
                .map(([col, val]) => {
                    if (val === null) return `${qStart}${col}${qEnd} IS NULL`;
                    return `${qStart}${col}${qEnd} = ${formatVal(val)}`;
                })
                .join(' AND ');
        }

        const whereClause = finalWhere;

        // Logic to prevent redundant naming (e.g., db.db.table)
        let sql = '';
        if (dialect === 'mssql') {
            const fullTable = table.includes('.') ? table : `[${targetDb}].${table}`;
            sql = `UPDATE ${fullTable} SET ${setClause} WHERE ${whereClause}`;
        } else if (dialect === 'postgres') {
            sql = `UPDATE "${table}" SET ${setClause} WHERE ${whereClause}`;
        } else {
            // MySQL / MariaDB
            // If table is 'db.table', we split it. If just 'table', we use targetDb.
            if (table.includes('.') && !table.startsWith('`')) {
                const parts = table.split('.');
                const dbPart = parts[0];
                const tablePart = parts[1];
                sql = `UPDATE \`${dbPart}\`.\`${tablePart}\` SET ${setClause} WHERE ${whereClause}`;
            } else if (table.includes('`.`')) {
                // Table already quoted and prefixed
                sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
            } else {
                sql = `UPDATE \`${targetDb}\`.\`${table}\` SET ${setClause} WHERE ${whereClause}`;
            }
        }

        console.log('--- DB UPDATE DEBUG ---');
        console.log('Dialect:', dialect);
        console.log('SQL:', sql);
        console.log('-----------------------');

        const dbProxy = await getDbProxy(config);

        try {
            const result = await dbProxy.query(sql);
            let rowsAffected = 0;

            if (result) {
                if (dialect === 'mssql') {
                    // Check multiple possible locations for rowsAffected in MSSQL
                    if (result.rowsAffected && Array.isArray(result.rowsAffected)) {
                        rowsAffected = result.rowsAffected[0];
                    } else if (typeof result.rowsAffected === 'number') {
                        rowsAffected = result.rowsAffected;
                    }
                } else if (dialect === 'postgres') {
                    rowsAffected = (result.rowCount !== undefined) ? result.rowCount : 1;
                } else {
                    // MySQL/MariaDB
                    rowsAffected = result.affectedRows || (result.data ? result.data.length : 0);
                }
            }

            return NextResponse.json({
                success: true,
                rowsAffected: rowsAffected
            });
        } finally {
            await dbProxy.close();
        }
    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: error.message || 'Update failed' },
            { status: 500 }
        );
    }
}
