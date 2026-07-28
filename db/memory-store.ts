import { env } from "cloudflare:workers";

export type RuntimeEnv = {
  DB: D1Database;
  RECORDINGS: R2Bucket;
  OPENAI_API_KEY?: string;
};

export function getRuntimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

let ready: Promise<void> | null = null;

export function ensureMemorySchema() {
  if (ready) return ready;

  const { DB } = getRuntimeEnv();
  ready = (async () => {
    await DB.batch([
      DB.prepare(`CREATE TABLE IF NOT EXISTS family_spaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS family_members (
        id TEXT PRIMARY KEY,
        family_id TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        status TEXT NOT NULL DEFAULT 'invited',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT
      )`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS elders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        relationship TEXT NOT NULL,
        birth_year TEXT NOT NULL DEFAULT '',
        birth_place TEXT NOT NULL DEFAULT '',
        personality TEXT NOT NULL DEFAULT '',
        boundaries TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS interviews (
        id TEXT PRIMARY KEY,
        elder_id TEXT NOT NULL,
        theme TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL DEFAULT 20,
        questions_json TEXT NOT NULL DEFAULT '[]',
        transcript TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        audio_key TEXT NOT NULL DEFAULT '',
        audio_type TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TEXT
      )`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        interview_id TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        time_label TEXT NOT NULL DEFAULT '时间待确认',
        location TEXT NOT NULL DEFAULT '',
        people TEXT NOT NULL DEFAULT '',
        quote TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      DB.prepare(
        "CREATE INDEX IF NOT EXISTS interviews_elder_idx ON interviews(elder_id, created_at)",
      ),
      DB.prepare(
        "CREATE INDEX IF NOT EXISTS stories_interview_idx ON stories(interview_id, created_at)",
      ),
      DB.prepare(
        "CREATE INDEX IF NOT EXISTS family_members_family_idx ON family_members(family_id, created_at)",
      ),
    ]);
  })();

  return ready;
}
