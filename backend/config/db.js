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

  // Convert MySQL syntax & '?' placeholders to PostgreSQL '$1', '$2', '$3'
  function convertSql(sql) {
    if (!sql || typeof sql !== 'string') return sql;
    let converted = sql.replace(/DATE_ADD\s*\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+HOUR\s*\)/gi, "CURRENT_TIMESTAMP + INTERVAL '$1 hours'");
    converted = converted.replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP');
    let i = 1;
    return converted.replace(/\?/g, () => `$${i++}`);
  }

  // Polyfill execute and query to match MySQL2 interface
  pool = {
    async query(sql, params) {
      const converted = convertSql(sql);
      const res = await pgPool.query(converted, params);
      return [res.rows, res.fields];
    },
    async execute(sql, params) {
      const converted = convertSql(sql);
      const res = await pgPool.query(converted, params);
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
      
      // Auto-initialize PostgreSQL tables if empty
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(36) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          phone VARCHAR(20) UNIQUE DEFAULT NULL,
          password_hash VARCHAR(255) NOT NULL,
          display_name VARCHAR(100) NOT NULL,
          avatar VARCHAR(500) DEFAULT NULL,
          bio TEXT DEFAULT NULL,
          is_online BOOLEAN DEFAULT FALSE,
          last_seen TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          privacy_last_seen VARCHAR(20) DEFAULT 'everyone',
          privacy_profile_photo VARCHAR(20) DEFAULT 'everyone',
          privacy_about VARCHAR(20) DEFAULT 'everyone',
          notification_prefs JSONB DEFAULT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          email_verified BOOLEAN DEFAULT FALSE,
          reset_token VARCHAR(255) DEFAULT NULL,
          reset_token_expires TIMESTAMPTZ DEFAULT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chats (
          id VARCHAR(36) PRIMARY KEY,
          type VARCHAR(20) NOT NULL DEFAULT 'direct',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chat_members (
          id SERIAL PRIMARY KEY,
          chat_id VARCHAR(36) NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
          user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(20) DEFAULT 'member',
          joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          last_read_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          is_archived BOOLEAN DEFAULT FALSE,
          is_muted BOOLEAN DEFAULT FALSE,
          UNIQUE(chat_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS blocked_users (
          id SERIAL PRIMARY KEY,
          blocker_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          blocked_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(blocker_id, blocked_id)
        );

        CREATE TABLE IF NOT EXISTS groups (
          id VARCHAR(36) PRIMARY KEY,
          chat_id VARCHAR(36) NOT NULL UNIQUE REFERENCES chats(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          description TEXT DEFAULT NULL,
          avatar VARCHAR(500) DEFAULT NULL,
          created_by VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS group_members (
          id SERIAL PRIMARY KEY,
          group_id VARCHAR(36) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(20) DEFAULT 'member',
          added_by VARCHAR(36) DEFAULT NULL,
          joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(group_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(36) PRIMARY KEY,
          chat_id VARCHAR(36) NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
          sender_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL DEFAULT 'text',
          content TEXT DEFAULT NULL,
          reply_to_id VARCHAR(36) DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL,
          is_edited BOOLEAN DEFAULT FALSE,
          is_deleted_for_all BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS statuses (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(50) DEFAULT 'text',
          content VARCHAR(700) NOT NULL,
          media_url VARCHAR(500) DEFAULT NULL,
          background VARCHAR(20) NOT NULL DEFAULT '#075E54',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMPTZ NOT NULL
        );
      `);

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
