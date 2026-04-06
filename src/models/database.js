const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/finance.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL CHECK(role IN ('admin', 'analyst', 'viewer')),
      status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS records (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      amount      REAL NOT NULL CHECK(amount > 0),
      type        TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category    TEXT NOT NULL,
      date        TEXT NOT NULL,
      notes       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_records_date     ON records(date)     WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_records_type     ON records(type)     WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_records_category ON records(category) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_records_user_id  ON records(user_id)  WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email)      WHERE deleted_at IS NULL;
  `);
}

module.exports = { getDb };
