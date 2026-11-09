// GET    /api/reviews?summary=1           -> { summary: { mountainId: {avg, n} } }
// GET    /api/reviews?mountain=ID         -> { reviews: [...] }
// POST   /api/reviews {mountain, stars, text, days}   (logged in)
// DELETE /api/reviews?mountain=ID                     (logged in, own review)
const { sql } = require("../lib/db");
const { currentUser } = require("../lib/auth");
const { body, fail, dbError } = require("../lib/http");

const MID = /^[a-z0-9]{2,40}$/;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const u = await currentUser(req);
    const q = req.query || {};
    if (req.method === "GET") {
      if (q.summary) {
        const rows = await sql()`SELECT mountain_id, AVG(stars)::float AS avg, COUNT(*)::int AS n FROM reviews GROUP BY mountain_id`;
        const summary = {}; rows.forEach(r => summary[r.mountain_id] = { avg: r.avg, n: r.n });
        return res.status(200).json({ summary });
      }
      if (!MID.test(q.mountain || "")) return fail(res, 400, "bad_request");
      const rows = await sql()`SELECT r.user_id, r.stars, r.body, r.days, r.updated_at, u.name
        FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.mountain_id = ${q.mountain} ORDER BY r.updated_at DESC LIMIT 200`;
      return res.status(200).json({ reviews: rows.map(r => ({
        name: (r.name || "").split(" ")[0] || "A rider", stars: r.stars, text: r.body, days: r.days,
        ts: r.updated_at, mine: !!u && r.user_id === u.id })) });
    }
    if (!u) return fail(res, 401, "login_required", "Log in to post a review.");
    if (req.method === "POST") {
      const b = body(req);
      const stars = parseInt(b.stars, 10);
      if (!MID.test(b.mountain || "") || !(stars >= 1 && stars <= 5)) return fail(res, 400, "bad_request");
      const text = String(b.text || "").trim().slice(0, 1500);
      const days = Number.isInteger(b.days) && b.days >= 0 && b.days < 400 ? b.days : null;
      await sql()`INSERT INTO reviews (user_id, mountain_id, stars, body, days) VALUES (${u.id}, ${b.mountain}, ${stars}, ${text}, ${days})
        ON CONFLICT (user_id, mountain_id) DO UPDATE SET stars = EXCLUDED.stars, body = EXCLUDED.body, days = EXCLUDED.days, updated_at = now()`;
      return res.status(200).json({ ok: true });
    }
    if (req.method === "DELETE") {
      if (!MID.test(q.mountain || "")) return fail(res, 400, "bad_request");
      await sql()`DELETE FROM reviews WHERE user_id = ${u.id} AND mountain_id = ${q.mountain}`;
      return res.status(200).json({ ok: true });
    }
    return fail(res, 405, "method");
  } catch (e) { return dbError(res, e); }
};
