const mssql = require('tedious');
const mysql = require('mysql2/promise');
const { Pool: PgPool } = require('pg');
const mssqlPkg = require('mssql');

async function getDbProxy(config) {
    let dbType = config.dbType;

    // Auto-detect dbType from connectionString if missing
    if (!dbType && config.connectionString) {
        const cs = config.connectionString.toLowerCase();
        if (cs.startsWith('mysql:')) dbType = 'mysql';
        else if (cs.startsWith('mariadb:')) dbType = 'mariadb';
        else if (cs.startsWith('postgres:') || cs.startsWith('postgresql:')) dbType = 'postgres';
        else if (cs.startsWith('mssql:')) dbType = 'mssql';
    }

    dbType = dbType || 'mssql';

    if (dbType === 'mysql' || dbType === 'mariadb') {
        let actualHost = config.server || 'localhost';
        let actualPort = config.port || 3306;
        if (typeof actualHost === 'string' && actualHost.includes(':')) {
            const parts = actualHost.split(':');
            actualHost = parts[0];
            actualPort = parseInt(parts[1]) || actualPort;
        }

        const sslConfig = config.options?.encrypt ? {
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2'
        } : undefined;

        const connConfig = config.connectionString
            ? { uri: config.connectionString, ssl: sslConfig, multipleStatements: true }
            : {
                host: actualHost,
                port: actualPort,
                user: config.user,
                password: config.password,
                database: config.database,
                multipleStatements: true,
                ssl: sslConfig
            };

        const connection = await mysql.createConnection(connConfig);

        return {
            query: async (sql) => {
                const [rows] = await connection.query(sql);
                return rows;
            },
            close: async () => {
                await connection.end();
            }
        };
    } else if (dbType === 'postgres') {
        const pool = new PgPool(
            config.connectionString
                ? { connectionString: config.connectionString }
                : {
                    host: config.server,
                    port: config.port || 5432,
                    user: config.user,
                    password: config.password,
                    database: config.database,
                    ssl: config.options?.encrypt ? { rejectUnauthorized: false } : false
                }
        );

        return {
            query: async (sql) => {
                const res = await pool.query(sql);
                return res.rows;
            },
            close: async () => {
                await pool.end();
            }
        };
    } else {
        // Default to MSSQL
        let pool;
        if (config.connectionString) {
            pool = await mssqlPkg.connect(config.connectionString);
        } else {
            pool = await mssqlPkg.connect({
                server: config.server,
                port: config.port || 1433,
                user: config.user,
                password: config.password,
                database: config.database,
                options: {
                    encrypt: true,
                    trustServerCertificate: true,
                    ...config.options,
                },
            });
        }

        const proxy = {
            query: async (sql) => {
                const result = await pool.request().query(sql);
                if (result.recordsets && result.recordsets.length > 1) {
                    return result.recordsets;
                }
                return result.recordset;
            },
            close: async () => {
                await pool.close();
            }
        };
        return proxy;
    }
}

module.exports = { getDbProxy };
