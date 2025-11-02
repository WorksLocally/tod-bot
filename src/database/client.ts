/**
 * Initializes and exports a shared SQLite connection used across the application.
 * Responsible for making sure the database exists and core tables are migrated.
 *
 * @module src/database/client
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import logger from '../utils/logger.js';
import config from '../config/env.js';

const databaseDir = path.dirname(config.databasePath);
if (!fs.existsSync(databaseDir)) {
  fs.mkdirSync(databaseDir, { recursive: true });
}

/**
 * Singleton database connection leveraged by services for queries and transactions.
 */
const db: Database.Database = new Database(config.databasePath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Ensures that all required tables, indexes, and defaults exist before the bot runs.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('truth','dare')),
    text TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    position INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_type_position
    ON questions (type, position);
  
  CREATE INDEX IF NOT EXISTS idx_questions_type
    ON questions (type);

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
  
  CREATE INDEX IF NOT EXISTS idx_submissions_user_status
    ON submissions (user_id, status);
  
  CREATE INDEX IF NOT EXISTS idx_submissions_type_status
    ON submissions (type, status);

  CREATE TABLE IF NOT EXISTS question_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating IN (-1, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (question_id, user_id),
    FOREIGN KEY (question_id) REFERENCES questions(question_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_question_ratings_question_id
    ON question_ratings (question_id);
  
  CREATE INDEX IF NOT EXISTS idx_question_ratings_user_id
    ON question_ratings (user_id);
`);

interface IndexInfo {
  unique: number;
  name: string;
}

interface ColumnInfo {
  name: string;
}

/**
 * Detects whether the questions table still enforces a global UNIQUE constraint on position,
 * which would prevent dare and truth lists from maintaining independent orderings.
 *
 * @returns True when migration is required.
 */
const needsPositionMigration = (): boolean => {
  const indexes = db.prepare("PRAGMA index_list('questions')").all() as IndexInfo[];
  return indexes.some((index) => {
    if (!index.unique) {
      return false;
    }
    const sanitizedName = index.name.replace(/'/g, "''");
    const columns = db.prepare(`PRAGMA index_info('${sanitizedName}')`).all() as ColumnInfo[];
    return columns.length === 1 && columns[0].name === 'position';
  });
};

/**
 * Rebuilds the questions table so that question positions are unique per type, preserving the
 * ordering of existing questions and updating rotation state accordingly.
 */
const migrateQuestionPositions = (): void => {
  const migrate = db.transaction(() => {
    db.exec(`
      ALTER TABLE questions RENAME TO questions_old;

      CREATE TABLE questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK (type IN ('truth','dare')),
        text TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        position INTEGER NOT NULL
      );
    `);

    db.exec(`
      CREATE TEMP TABLE question_position_map AS
      SELECT
        question_id,
        type,
        text,
        created_by,
        created_at,
        updated_at,
        position AS old_position,
        ROW_NUMBER() OVER (PARTITION BY type ORDER BY position, id) AS new_position
      FROM questions_old
      ORDER BY type, position, id;
    `);

    db.exec(`
      INSERT INTO questions (question_id, type, text, created_by, created_at, updated_at, position)
      SELECT
        question_id,
        type,
        text,
        created_by,
        created_at,
        updated_at,
        new_position
      FROM question_position_map
      ORDER BY type, new_position;
    `);

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_type_position
        ON questions (type, position);
    `);

    db.exec(`
      DROP TABLE questions_old;
    `);

    db.exec(`
      UPDATE rotation_state
      SET last_position = COALESCE((
        SELECT MAX(new_position)
        FROM question_position_map
        WHERE question_position_map.type = rotation_state.type
          AND question_position_map.old_position <= rotation_state.last_position
      ), 0);
    `);

    db.exec(`
      DROP TABLE IF EXISTS question_position_map;
    `);
  });

  migrate();
};

if (needsPositionMigration()) {
  try {
    migrateQuestionPositions();
    logger.info('Migrated question positions to be unique per type.');
  } catch (error) {
    logger.error('Failed to migrate question positions', { error });
    throw error;
  }
}

export default db;
