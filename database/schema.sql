-- ============================================================
-- ChatFlow Database Schema
-- MySQL 8+
-- Run: mysql -u root -p < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS chatflow_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE chatflow_db;

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)  PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone         VARCHAR(20)  UNIQUE DEFAULT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  avatar        VARCHAR(500) DEFAULT NULL,
  bio           TEXT         DEFAULT NULL,
  is_online     BOOLEAN      DEFAULT FALSE,
  last_seen     DATETIME     DEFAULT CURRENT_TIMESTAMP,

  -- Privacy settings
  privacy_last_seen    ENUM('everyone','contacts','nobody') DEFAULT 'everyone',
  privacy_profile_photo ENUM('everyone','contacts','nobody') DEFAULT 'everyone',
  privacy_about        ENUM('everyone','contacts','nobody') DEFAULT 'everyone',

  -- Notification preferences (stored as JSON string)
  notification_prefs   JSON DEFAULT NULL,

  -- Account state
  is_active            BOOLEAN      DEFAULT TRUE,
  email_verified       BOOLEAN      DEFAULT FALSE,
  reset_token          VARCHAR(255) DEFAULT NULL,
  reset_token_expires  DATETIME     DEFAULT NULL,

  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_users_email        (email),
  INDEX idx_users_phone        (phone),
  INDEX idx_users_display_name (display_name),
  INDEX idx_users_is_online    (is_online)
);

-- ─── CONTACTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(36) NOT NULL,
  contact_id  VARCHAR(36) NOT NULL,
  nickname    VARCHAR(100) DEFAULT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY  uq_contact (user_id, contact_id),
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_contacts_user_id (user_id)
);

-- ─── BLOCKED USERS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  blocker_id  VARCHAR(36) NOT NULL,
  blocked_id  VARCHAR(36) NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY  uq_block (blocker_id, blocked_id),
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_blocked_blocker (blocker_id)
);

-- ─── CHATS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
  id          VARCHAR(36) PRIMARY KEY,
  type        ENUM('direct','group') NOT NULL DEFAULT 'direct',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_chats_updated (updated_at),
  INDEX idx_chats_type    (type)
);

-- ─── CHAT MEMBERS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_members (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  chat_id      VARCHAR(36) NOT NULL,
  user_id      VARCHAR(36) NOT NULL,
  role         ENUM('member','admin','owner') DEFAULT 'member',
  joined_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_archived  BOOLEAN  DEFAULT FALSE,
  is_muted     BOOLEAN  DEFAULT FALSE,

  UNIQUE KEY  uq_chat_member (chat_id, user_id),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_chat_members_chat_id (chat_id),
  INDEX idx_chat_members_user_id (user_id)
);

-- ─── GROUPS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `groups` (
  id          VARCHAR(36) PRIMARY KEY,
  chat_id     VARCHAR(36) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  description TEXT         DEFAULT NULL,
  avatar      VARCHAR(500) DEFAULT NULL,
  created_by  VARCHAR(36) NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (chat_id)    REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── GROUP MEMBERS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_members (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  group_id  VARCHAR(36) NOT NULL,
  user_id   VARCHAR(36) NOT NULL,
  role      ENUM('member','admin') DEFAULT 'member',
  added_by  VARCHAR(36) DEFAULT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY  uq_group_member (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_group_members_group_id (group_id),
  INDEX idx_group_members_user_id  (user_id)
);

-- ─── MESSAGES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id                  VARCHAR(36) PRIMARY KEY,
  chat_id             VARCHAR(36) NOT NULL,
  sender_id           VARCHAR(36) NOT NULL,
  type                ENUM('text','image','video','audio','document','voice','location','system') NOT NULL DEFAULT 'text',
  content             TEXT        DEFAULT NULL,
  reply_to_id         VARCHAR(36) DEFAULT NULL,
  is_edited           BOOLEAN     DEFAULT FALSE,
  is_deleted_for_all  BOOLEAN     DEFAULT FALSE,
  created_at          DATETIME    DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (chat_id)     REFERENCES chats(id)    ON DELETE CASCADE,
  FOREIGN KEY (sender_id)   REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL,
  INDEX idx_messages_chat_id    (chat_id),
  INDEX idx_messages_sender_id  (sender_id),
  INDEX idx_messages_created_at (created_at),
  FULLTEXT INDEX ft_messages_content (content)
);

-- ─── MESSAGE READS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reads (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  message_id  VARCHAR(36) NOT NULL,
  user_id     VARCHAR(36) NOT NULL,
  read_at     DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY  uq_message_read (message_id, user_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_message_reads_message_id (message_id)
);

-- ─── MESSAGE REACTIONS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reactions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  message_id  VARCHAR(36)  NOT NULL,
  user_id     VARCHAR(36)  NOT NULL,
  emoji       VARCHAR(10)  NOT NULL,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY  uq_reaction (message_id, user_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
);

-- ─── MESSAGE DELETIONS (Delete for Me) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_deletions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  message_id  VARCHAR(36) NOT NULL,
  user_id     VARCHAR(36) NOT NULL,
  deleted_at  DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY  uq_deletion (message_id, user_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
);

-- ─── STARRED MESSAGES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS starred_messages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  message_id  VARCHAR(36) NOT NULL,
  user_id     VARCHAR(36) NOT NULL,
  starred_at  DATETIME DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY  uq_star (message_id, user_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
);

-- ─── MEDIA ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media (
  id               VARCHAR(36) PRIMARY KEY,
  message_id       VARCHAR(36)  DEFAULT NULL,
  uploader_id      VARCHAR(36)  NOT NULL,
  file_name        VARCHAR(255) NOT NULL,
  original_name    VARCHAR(255) NOT NULL,
  file_type        VARCHAR(100) NOT NULL,
  file_size        INT          NOT NULL,
  file_path        VARCHAR(500) NOT NULL,
  thumbnail_path   VARCHAR(500) DEFAULT NULL,
  duration_seconds INT          DEFAULT NULL,
  created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (message_id)  REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (uploader_id) REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_media_message_id (message_id)
);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         VARCHAR(36) PRIMARY KEY,
  user_id    VARCHAR(36)  NOT NULL,
  type       ENUM('message','group_invite','call','system') NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT         DEFAULT NULL,
  is_read    BOOLEAN      DEFAULT FALSE,
  ref_type   VARCHAR(50)  DEFAULT NULL,
  ref_id     VARCHAR(36)  DEFAULT NULL,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_id (user_id),
  INDEX idx_notifications_is_read (is_read)
);

-- ─── CALLS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calls (
  id               VARCHAR(36) PRIMARY KEY,
  chat_id          VARCHAR(36) NOT NULL,
  caller_id        VARCHAR(36) NOT NULL,
  callee_id        VARCHAR(36) DEFAULT NULL,
  type             ENUM('voice','video') NOT NULL,
  status           ENUM('ringing','active','ended','missed','rejected') DEFAULT 'ringing',
  started_at       DATETIME    DEFAULT CURRENT_TIMESTAMP,
  answered_at      DATETIME    DEFAULT NULL,
  ended_at         DATETIME    DEFAULT NULL,
  duration_seconds INT         DEFAULT 0,

  FOREIGN KEY (chat_id)   REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (caller_id) REFERENCES users(id)  ON DELETE CASCADE,
  INDEX idx_calls_chat_id   (chat_id),
  INDEX idx_calls_caller_id (caller_id)
);

-- STATUS UPDATES (expire after 24 hours)
CREATE TABLE IF NOT EXISTS statuses (
  id            VARCHAR(36) PRIMARY KEY,
  user_id       VARCHAR(36) NOT NULL,
  content       VARCHAR(700) NOT NULL,
  background    VARCHAR(20) NOT NULL DEFAULT '#075E54',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_statuses_user_id (user_id),
  INDEX idx_statuses_expires_at (expires_at)
);
