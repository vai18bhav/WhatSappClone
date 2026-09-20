// backend/config/db.js
// MySQL2 connection pool — promise-based
'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Create a connection pool for MySQL.
 * Pooling reuses connections instead of opening a new one per query.
 */
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  database:           process.env.DB_NAME     || 'chatflow_db',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit:    20,          // max simultaneous connections
  queueLimit:         0,           // unlimited queue
  timezone:           '+00:00',    // store times in UTC
  charset:            'utf8mb4',
});

/**
 * Test database connectivity.
 * Called once at server startup.
 */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅  MySQL connected — database:', process.env.DB_NAME);

    // Ensure statuses table columns for multi-media support
    try {
      await conn.query("ALTER TABLE statuses ADD COLUMN IF NOT EXISTS type ENUM('text','image','video','audio') NOT NULL DEFAULT 'text'");
      await conn.query("ALTER TABLE statuses ADD COLUMN IF NOT EXISTS media_url VARCHAR(500) DEFAULT NULL");
      await conn.query("ALTER TABLE statuses MODIFY COLUMN content TEXT DEFAULT NULL");
    } catch (e) {
      // Column verification fallback
    }

    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message || err.code || err);
    if (err.code === 'ECONNREFUSED') {
      console.error(`👉  Could not connect to MySQL server at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}. Please check if the MySQL service is running and the port is correct.`);
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(`👉  Access denied for user '${process.env.DB_USER || 'root'}'. Please verify your DB_PASSWORD in .env.`);
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error(`👉  Database '${process.env.DB_NAME}' does not exist. Please run: mysql -u root -p -P ${process.env.DB_PORT || 3306} < database/schema.sql`);
    }
    process.exit(1); // fatal — cannot run without a database
  }
}

module.exports = { pool, testConnection };
