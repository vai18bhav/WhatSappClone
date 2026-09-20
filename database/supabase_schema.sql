-- ============================================================
-- ChatFlow Supabase (PostgreSQL) Database Migration Script
-- Copy & Paste this script into Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone         VARCHAR(20) UNIQUE DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  avatar        VARCHAR(500) DEFAULT NULL,
  bio           TEXT DEFAULT NULL,
  is_online     BOOLEAN DEFAULT FALSE,
  last_seen     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  privacy_last_seen     VARCHAR(20) DEFAULT 'everyone',
  privacy_profile_photo VARCHAR(20) DEFAULT 'everyone',
  privacy_about         VARCHAR(20) DEFAULT 'everyone',
  notification_prefs    JSONB DEFAULT NULL,
  is_active             BOOLEAN DEFAULT TRUE,
  email_verified        BOOLEAN DEFAULT FALSE,
  reset_token           VARCHAR(255) DEFAULT NULL,
  reset_token_expires   TIMESTAMPTZ DEFAULT NULL,
  created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── CONTACTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id          SERIAL PRIMARY KEY,
  user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id  VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname    VARCHAR(100) DEFAULT NULL,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, contact_id)
);

-- ─── BLOCKED USERS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_users (
  id          SERIAL PRIMARY KEY,
  blocker_id  VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(blocker_id, blocked_id)
);

-- ─── CHATS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
  id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type        VARCHAR(20) NOT NULL DEFAULT 'direct',
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── CHAT MEMBERS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_members (
  id           SERIAL PRIMARY KEY,
  chat_id      VARCHAR(36) NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id      VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         VARCHAR(20) DEFAULT 'member',
  joined_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_read_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  is_archived  BOOLEAN DEFAULT FALSE,
  is_muted     BOOLEAN DEFAULT FALSE,
  UNIQUE(chat_id, user_id)
);

-- ─── GROUPS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id     VARCHAR(36) NOT NULL UNIQUE REFERENCES chats(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  avatar      VARCHAR(500) DEFAULT NULL,
  created_by  VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── GROUP MEMBERS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_members (
  id        SERIAL PRIMARY KEY,
  group_id  VARCHAR(36) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      VARCHAR(20) DEFAULT 'member',
  added_by  VARCHAR(36) DEFAULT NULL,
  joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, user_id)
);

-- ─── MESSAGES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id                  VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id             VARCHAR(36) NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id           VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                VARCHAR(50) NOT NULL DEFAULT 'text',
  content             TEXT DEFAULT NULL,
  reply_to_id         VARCHAR(36) DEFAULT NULL REFERENCES messages(id) ON DELETE SET NULL,
  is_edited           BOOLEAN DEFAULT FALSE,
  is_deleted_for_all  BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── MESSAGE READS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reads (
  id          SERIAL PRIMARY KEY,
  message_id  VARCHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);

-- ─── MESSAGE REACTIONS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reactions (
  id          SERIAL PRIMARY KEY,
  message_id  VARCHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       VARCHAR(10) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);

-- ─── MESSAGE DELETIONS (Delete for Me) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_deletions (
  id          SERIAL PRIMARY KEY,
  message_id  VARCHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deleted_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);

-- ─── STARRED MESSAGES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS starred_messages (
  id          SERIAL PRIMARY KEY,
  message_id  VARCHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starred_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id)
);

-- ─── MEDIA ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media (
  id               VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id       VARCHAR(36) DEFAULT NULL REFERENCES messages(id) ON DELETE CASCADE,
  uploader_id      VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name        VARCHAR(255) NOT NULL,
  original_name    VARCHAR(255) NOT NULL,
  file_type        VARCHAR(100) NOT NULL,
  file_size        INT NOT NULL,
  file_path        VARCHAR(500) NOT NULL,
  thumbnail_path   VARCHAR(500) DEFAULT NULL,
  duration_seconds INT DEFAULT NULL,
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT DEFAULT NULL,
  is_read    BOOLEAN DEFAULT FALSE,
  ref_type   VARCHAR(50) DEFAULT NULL,
  ref_id     VARCHAR(36) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── CALLS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calls (
  id               VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_id          VARCHAR(36) NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  caller_id        VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id        VARCHAR(36) DEFAULT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             VARCHAR(20) NOT NULL,
  status           VARCHAR(20) DEFAULT 'ringing',
  started_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  answered_at      TIMESTAMPTZ DEFAULT NULL,
  ended_at         TIMESTAMPTZ DEFAULT NULL,
  duration_seconds INT DEFAULT 0
);

-- ─── STATUS UPDATES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS statuses (
  id            VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(50) DEFAULT 'text',
  content       VARCHAR(700) NOT NULL,
  media_url     VARCHAR(500) DEFAULT NULL,
  background    VARCHAR(20) NOT NULL DEFAULT '#075E54',
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at    TIMESTAMPTZ NOT NULL
);
