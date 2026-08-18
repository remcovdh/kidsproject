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

  CREATE TABLE IF NOT EXISTS photo_captures (
    id         TEXT PRIMARY KEY,
    child_id   TEXT NOT NULL REFERENCES children(id),
    kind       TEXT NOT NULL CHECK (kind IN ('drawing','world')),
    url        TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending_child_confirm'
               CHECK (status IN ('pending_child_confirm','approved','rejected')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_photo_captures_child ON photo_captures(child_id, kind);

  -- Global (cross-session) tally of which generation approach kids prefer — "text" (generated
  -- purely from a written description) vs "image" (image-to-image, edited directly from their
  -- photo). Not session-scoped on purpose: a single ~20-kid session is too small a sample to
  -- mean much on its own; this is meant to accumulate across every session ever run so the
  -- choice can eventually be retired in favor of whichever approach clearly wins (that decision
  -- itself is deliberately deferred — this table only collects the data for now).
  CREATE TABLE IF NOT EXISTS generation_choices (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL CHECK (kind IN ('character','world')),
    chosen     TEXT NOT NULL CHECK (chosen IN ('text','image')),
    child_id   TEXT REFERENCES children(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Idempotent migration: add children.display_code if it doesn't exist yet
// (no migration framework in this project — see the CREATE TABLE IF NOT EXISTS style above).
const childCols = db.prepare("PRAGMA table_info(children)").all() as Array<{ name: string }>;
if (!childCols.some((c) => c.name === "display_code")) {
  db.exec("ALTER TABLE children ADD COLUMN display_code TEXT");
}

// Idempotent migration: add sessions.join_code if it doesn't exist yet — the short code a
// facilitator shares so kids can join without typing/scanning a full session URL.
const sessionCols = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
if (!sessionCols.some((c) => c.name === "join_code")) {
  db.exec("ALTER TABLE sessions ADD COLUMN join_code TEXT");
}

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

// Backfill join codes for any session that doesn't have one yet (the demo session on first
// run, or any session created before the join_code column existed).
const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L — easy to read aloud
export function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  return code;
}
const needsCode = db.prepare("SELECT id FROM sessions WHERE join_code IS NULL").all() as Array<{ id: string }>;
for (const { id } of needsCode) {
  let code: string;
  do { code = generateJoinCode(); } while (db.prepare("SELECT 1 FROM sessions WHERE join_code = ?").get(code));
  db.prepare("UPDATE sessions SET join_code = ? WHERE id = ?").run(code, id);
}

export default db;
