import mssql from 'mssql';
import mysql from 'mysql2/promise';
import { Pool as PgPool } from 'pg';

export interface DbProxy {
  query: (sql: string) => Promise<any>;
  close: () => Promise<void>;
}

export async function getDbProxy(config: any): Promise<DbProxy> {
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
    // Parse host:port if provided in the server field
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

    let connConfig: any = config.connectionString
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
      query: async (sql: string) => {
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
      query: async (sql: string) => {
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
      pool = await mssql.connect(config.connectionString);
    } else {
      pool = await mssql.connect({
        ...config,
        options: {
          encrypt: true,
          trustServerCertificate: true,
          ...config.options,
        },
      });
    }

    const proxy: DbProxy = {
      query: async (sql: string) => {
        const result = await pool.request().query(sql) as any;
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
