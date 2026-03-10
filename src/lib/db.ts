import mssql from 'mssql';
import mysql from 'mysql2/promise';
import { Pool as PgPool } from 'pg';
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import { Kafka } from 'kafkajs';

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
    else if (cs.startsWith('mongodb:')) dbType = 'mongodb';
    else if (cs.startsWith('redis:')) dbType = 'redis';
    else if (cs.startsWith('kafka:')) dbType = 'kafka';
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
      ? {
        uri: config.connectionString,
        ssl: sslConfig,
        multipleStatements: true,
        connectTimeout: 15000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
      }
      : {
        host: actualHost,
        port: actualPort,
        user: config.user,
        password: config.password,
        database: config.database,
        multipleStatements: true,
        ssl: sslConfig,
        connectTimeout: 15000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
      };

    let connection: any;
    try {
      connection = await mysql.createConnection(connConfig);
    } catch (err: any) {
      // Intermittent network issues (Tailscale/VPN) can cause timeouts. Retry once.
      if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.message.includes('timeout')) {
        console.warn('MySQL Connection failed, retrying...', err.message);
        connection = await mysql.createConnection(connConfig);
      } else {
        throw err;
      }
    }

    return {
      query: async (sql: string) => {
        const [rows] = await connection.query(sql);
        // If rows is a ResultSetHeader (for updates/inserts), it has affectedRows
        return rows;
      },
      close: async () => {
        if (connection) await connection.end();
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
        const rows = res.rows as any;
        if (rows && typeof rows === 'object') {
          rows.rowCount = res.rowCount;
        }
        return rows;
      },
      close: async () => {
        await pool.end();
      }
    };
  } else if (dbType === 'mongodb') {
    const uri = config.connectionString || `mongodb://${config.user ? `${config.user}:${config.password}@` : ''}${config.server || 'localhost'}:${config.port || 27017}/${config.database || ''}`;
    const client = new MongoClient(uri);
    await client.connect();
    // Use the database from the connection or default to admin
    const db = client.db(config.database || 'admin');

    return {
      query: async (queryStr: string) => {
        // Execute arbitrary JavaScript or parse JSON
        // Since we are building NoSQL Phase 3, we expect queries to be in the form of a JSON object for aggregations
        // OR a specific command structure.
        // For basic functionality, let's treat queryStr as a JSON string for a find operation on a collection.
        // E.g., { "collection": "users", "action": "find", "query": {} }
        try {
          // If queryStr is JSON, parse and execute
          const req = JSON.parse(queryStr);
          if (req.collection && req.action === 'find') {
            const cursor = db.collection(req.collection).find(req.query || {});
            if (req.projection) cursor.project(req.projection);
            if (req.limit) cursor.limit(req.limit);
            else cursor.limit(100);
            return await cursor.toArray();
          } else if (req.action === 'aggregate') {
            return await db.collection(req.collection).aggregate(req.pipeline || []).toArray();
          } else if (req.action === 'listCollections') {
            return await db.listCollections().toArray();
          } else {
            return { message: "Unsupported MongoDB action natively in query, please use {collection, action: 'find'/'aggregate' ... }" };
          }
        } catch (e) {
          // Fallback: simple ping if it's just 'ping'
          if (queryStr.trim() === 'ping') {
            await db.command({ ping: 1 });
            return [{ status: 'ok' }];
          }
          throw new Error('MongoDB query must be a valid JSON object specifying action and collection.');
        }
      },
      close: async () => {
        await client.close();
      }
    };
  } else if (dbType === 'redis') {
    const uri = config.connectionString || `redis://${config.user ? `:${config.password}@` : ''}${config.server || 'localhost'}:${config.port || 6379}`;
    const redis = new Redis(uri);

    return {
      query: async (cmd: string) => {
        // Simple CLI emulation
        const parts = cmd.trim().split(/\s+/);
        if (parts.length > 0 && parts[0]) {
          const commandName = parts[0].toLowerCase();
          const args = parts.slice(1);
          if (typeof (redis as any)[commandName] === 'function') {
            const result = await (redis as any)[commandName](...args);
            return Array.isArray(result) ? result : [{ result }];
          } else {
            throw new Error(`Redis command ${commandName} not supported.`);
          }
        }
        return [];
      },
      close: async () => {
        redis.disconnect();
      }
    };
  } else if (dbType === 'kafka') {
    const broker = config.connectionString
      ? config.connectionString.replace('kafka://', '')
      : `${config.server || 'localhost'}:${config.port || 9092}`;

    const kafka = new Kafka({
      clientId: config.name || 'data-forge-client',
      brokers: [broker],
      ssl: config.options?.encrypt ? true : false,
      sasl: config.user && config.password ? {
        mechanism: 'plain',
        username: config.user,
        password: config.password
      } : undefined
    });

    const admin = kafka.admin();
    await admin.connect();

    return {
      query: async (queryStr: string) => {
        try {
          const req = JSON.parse(queryStr);
          if (req.action === 'listTopics') {
            const topics = await admin.listTopics();
            // Filter out internal topics if needed, but returning all for now
            return topics.map(t => ({ topic: t }));
          } else if (req.action === 'consume' && req.topic) {
            const consumer = kafka.consumer({ groupId: `df-group-${Date.now()}` });
            await consumer.connect();
            await consumer.subscribe({ topic: req.topic, fromBeginning: req.fromBeginning || false });

            const messages: any[] = [];
            const limit = req.limit || 50;

            return new Promise(async (resolve, reject) => {
              const timeout = setTimeout(async () => {
                await consumer.disconnect();
                resolve(messages);
              }, 5000); // Wait up to 5s for messages

              try {
                await consumer.run({
                  eachMessage: async ({ topic, partition, message }) => {
                    messages.push({
                      topic,
                      partition,
                      offset: message.offset,
                      key: message.key ? message.key.toString() : null,
                      value: message.value ? message.value.toString() : null,
                      timestamp: message.timestamp
                    });

                    if (messages.length >= limit) {
                      clearTimeout(timeout);
                      await consumer.disconnect();
                      resolve(messages);
                    }
                  },
                });
              } catch (err) {
                clearTimeout(timeout);
                await consumer.disconnect();
                reject(err);
              }
            });
          } else if (req.action === 'publish' && req.topic && req.messages) {
            const producer = kafka.producer();
            await producer.connect();
            await producer.send({
              topic: req.topic,
              messages: Array.isArray(req.messages) ? req.messages : [req.messages],
            });
            await producer.disconnect();
            return [{ status: 'success', published: true }];
          } else {
            return { error: 'Unknown Kafka action. Use listTopics, consume, or publish.' };
          }
        } catch (e: any) {
          if (queryStr === 'ping') {
            const topics = await admin.listTopics();
            return [{ status: 'ok', topics: topics.length }];
          }
          throw new Error(`Kafka query must be a valid JSON object: ${e.message}`);
        }
      },
      close: async () => {
        await admin.disconnect();
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
        let data = (result.recordsets && result.recordsets.length > 1)
          ? result.recordsets
          : result.recordset;

        // Attach metadata to the returned data (array or object)
        if (data && typeof data === 'object') {
          data.rowsAffected = result.rowsAffected;
        } else if (data === undefined) {
          // For queries with no recordset (like UPDATE), return a dummy object with metadata
          data = { rowsAffected: result.rowsAffected };
        }

        return data;
      },
      close: async () => {
        await pool.close();
      }
    };
    return proxy;
  }
}
