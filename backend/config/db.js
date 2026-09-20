// backend/config/db.js
// MySQL2 connection pool — promise-based
'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Create a connection pool for MySQL.
 * Pooling reuses connections instead of opening a new one per query.
 */
const { Pool: PgPool } = require('pg');

let pool;
let isPg = false;

if (process.env.DATABASE_URL) {
  isPg = true;
  const pgPool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // Polyfill execute and query to match MySQL2 interface
  pool = {
    async query(sql, params) {
      const res = await pgPool.query(sql, params);
      return [res.rows, res.fields];
    },
    async execute(sql, params) {
      const res = await pgPool.query(sql, params);
      return [res.rows, res.fields];
    },
    async getConnection() {
      return pgPool.connect();
    },
    connect() {
      return pgPool.connect();
    }
  };
} else {
  pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT) || 3306,
    database:           process.env.DB_NAME     || 'chatflow_db',
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit:    20,
    queueLimit:         0,
    timezone:           '+00:00',
    charset:            'utf8mb4',
  });
}

/**
 * Test database connectivity.
 * Called once at server startup.
 */
async function testConnection() {
  try {
    if (isPg) {
      const client = await pool.connect();
      console.log('✅  PostgreSQL connected via DATABASE_URL');
      client.release();
    } else {
      const conn = await pool.getConnection();
      console.log('✅  MySQL connected — database:', process.env.DB_NAME);
      conn.release();
    }
  } catch (err) {
    console.error('❌  Database connection failed:', err.message || err.code || err);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
