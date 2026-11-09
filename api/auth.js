// GET  /api/auth                      -> { user } (null when logged out)
// POST /api/auth {action:"signup", name, email, password}
// POST /api/auth {action:"login", email, password}
// POST /api/auth {action:"logout"}
const bcrypt = require("bcryptjs");
const { sql } = require("../lib/db");
const { startSession, endSession, currentUser, publicUser } = require("../lib/auth");
const { body, fail, dbError } = require("../lib/http");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") return res.status(200).json({ user: publicUser(await currentUser(req)) });
    if (req.method !== "POST") return fail(res, 405, "method");

    await currentUser(req); // makes sure the tables exist
    const b = body(req);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 200);
    const password = String(b.password || "");

    if (b.action === "logout") { await endSession(req, res); return res.status(200).json({ user: null }); }

    if (b.action === "signup") {
      const name = String(b.name || "").trim().slice(0, 60);
      if (!EMAIL.test(email)) return fail(res, 400, "invalid_email", "Enter a valid email address.");
      if (password.length < 8) return fail(res, 400, "weak_password", "Use at least 8 characters for your password.");
      const exists = await sql()`SELECT 1 FROM users WHERE email = ${email}`;
      if (exists.length) return fail(res, 409, "email_taken", "An account with that email already exists. Log in instead.");
      const hash = await bcrypt.hash(password, 10);
      const [u] = await sql()`INSERT INTO users (email, name, password_hash) VALUES (${email}, ${name}, ${hash}) RETURNING *`;
      await sql()`INSERT INTO user_data (user_id) VALUES (${u.id}) ON CONFLICT DO NOTHING`;
      await startSession(res, u.id);
      return res.status(201).json({ user: publicUser(u) });
    }

    if (b.action === "login") {
      const [u] = await sql()`SELECT * FROM users WHERE email = ${email}`;
      const ok = u && await bcrypt.compare(password, u.password_hash);
      if (!ok) return fail(res, 401, "bad_credentials", "That email and password don't match an account.");
      await startSession(res, u.id);
      return res.status(200).json({ user: publicUser(u) });
    }

    return fail(res, 400, "bad_request");
  } catch (e) { return dbError(res, e); }
};
