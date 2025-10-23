const fs = require('fs');
const path = require('path');

const Database = require('better-sqlite3');

const config = require('../config/env');

const databaseDir = path.dirname(config.databasePath);
if (!fs.existsSync(databaseDir)) {
  fs.mkdirSync(databaseDir, { recursive: true });
}

const db = new Database(config.databasePath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('truth','dare')),
    text TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    position INTEGER NOT NULL UNIQUE
  );

  CREATE INDEX IF NOT EXISTS idx_questions_type_position
    ON questions (type, position);

  CREATE TABLE IF NOT EXISTS rotation_state (
    type TEXT PRIMARY KEY,
    last_position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('truth','dare')),
    text TEXT NOT NULL,
    user_id TEXT NOT NULL,
    guild_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    resolver_id TEXT,
    approval_message_id TEXT,
    approval_channel_id TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_submissions_status
    ON submissions (status);
`);

module.exports = db;
