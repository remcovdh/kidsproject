import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(__dirname, "../uploads");
export const DB_PATH    = process.env.DB_PATH    ?? join(__dirname, "../data/kidsproject.db");

mkdirSync(join(DB_PATH, ".."), { recursive: true });
mkdirSync(UPLOAD_DIR,          { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    show_prompt INTEGER NOT NULL DEFAULT 1,
    ai_provider TEXT NOT NULL DEFAULT 'openai',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS children (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    name       TEXT NOT NULL,
    game_type  TEXT NOT NULL DEFAULT 'catcher',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sprite_versions (
    id         TEXT PRIMARY KEY,
    child_id   TEXT NOT NULL REFERENCES children(id),
    label      TEXT NOT NULL,
    prompt     TEXT NOT NULL,
    sprites    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS published_games (
    id                TEXT PRIMARY KEY,
    child_id          TEXT NOT NULL REFERENCES children(id),
    session_id        TEXT NOT NULL REFERENCES sessions(id),
    sprite_version_id TEXT NOT NULL REFERENCES sprite_versions(id),
    sounds            TEXT NOT NULL DEFAULT '{}',
    background_url    TEXT,
    published_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed a demo session on first run.
// AI_PROVIDER env var sets (and on every restart updates) the demo session's provider,
// so switching from openai → local is just a matter of changing the env var.
const aiProvider = process.env.AI_PROVIDER ?? "openai";
const { n } = db.prepare("SELECT COUNT(*) as n FROM sessions").get() as { n: number };
if (n === 0) {
  db.prepare(
    "INSERT INTO sessions (id, name, show_prompt, ai_provider) VALUES (?, ?, ?, ?)"
  ).run("demo", "Dragon Workshop 🐉", 1, aiProvider);
  console.log(`  → seeded demo session (id: demo, provider: ${aiProvider})`);
} else if (process.env.AI_PROVIDER) {
  db.prepare("UPDATE sessions SET ai_provider = ? WHERE id = 'demo'").run(aiProvider);
}

export default db;
