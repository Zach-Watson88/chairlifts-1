// Sessions: a random token in an HttpOnly cookie; only its SHA-256 hash is stored in Neon.
const crypto = require("crypto");
const { sql, ensure } = require("./db");

const COOKIE = "cl_session";
const DAYS = 30;
const FREE_COACH_PER_MONTH = 1;

const hash = t => crypto.createHash("sha256").update(t).digest("hex");
const monthKey = () => new Date().toISOString().slice(0, 7);

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

async function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await sql()`INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${hash(token)}, ${userId}, now() + make_interval(days => ${DAYS}))`;
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`);
}

async function endSession(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) await sql()`DELETE FROM sessions WHERE token_hash = ${hash(token)}`;
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

async function currentUser(req) {
  await ensure();
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const rows = await sql()`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hash(token)} AND s.expires_at > now()`;
  return rows[0] || null;
}

function coachLeft(u) {
  if (u.is_pro) return null; // unlimited
  const used = u.coach_month === monthKey() ? u.coach_uses : 0;
  return Math.max(0, FREE_COACH_PER_MONTH - used);
}

function publicUser(u) {
  return u ? { id: u.id, email: u.email, name: u.name, isPro: u.is_pro, proSince: u.pro_since, coachLeft: coachLeft(u), freePerMonth: FREE_COACH_PER_MONTH } : null;
}

module.exports = { startSession, endSession, currentUser, publicUser, coachLeft, monthKey };
