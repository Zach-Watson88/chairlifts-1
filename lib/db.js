// Neon Postgres connection + table setup. Tables are created on first use,
// and the demo account (demo@demo.com / password123!) is created or repaired
// so it always exists with full Pro access.
const { neon } = require("@neondatabase/serverless");

// bcrypt hash of "password123!" (the published demo password, not a secret)
const DEMO_HASH = "$2b$10$D//jgh0VPr.HxhnLAO88iOsKxq80q3MIt55r9vii7owvmpVwQY0xC";

let client = null;
function sql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED;
  if (!url) { const e = new Error("Database not connected"); e.code = "no_db"; throw e; }
  if (!client) client = neon(url);
  return client;
}

let ready = null;
function ensure() {
  if (!ready) {
    ready = (async () => {
      const q = sql();
      await q`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        is_pro BOOLEAN NOT NULL DEFAULT false,
        pro_since TIMESTAMPTZ,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        coach_month TEXT NOT NULL DEFAULT '',
        coach_uses INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await q`CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await q`CREATE TABLE IF NOT EXISTS user_data (
        user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        season JSONB NOT NULL DEFAULT '{}'::jsonb,
        coach_history JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await q`CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mountain_id TEXT NOT NULL,
        stars INT NOT NULL CHECK (stars BETWEEN 1 AND 5),
        body TEXT NOT NULL DEFAULT '',
        days INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, mountain_id)
      )`;
      await q`INSERT INTO users (email, name, password_hash, is_pro, pro_since)
        VALUES ('demo@demo.com', 'Demo Rider', ${DEMO_HASH}, true, now())
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_pro = true,
          pro_since = COALESCE(users.pro_since, now())`;
      await q`DELETE FROM sessions WHERE expires_at < now()`;
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
}

module.exports = { sql, ensure };
