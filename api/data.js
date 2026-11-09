// Per-user saved data: season log and AI coach history.
// GET /api/data -> { season, coachHistory }     PUT /api/data { season }
const { sql } = require("../lib/db");
const { currentUser } = require("../lib/auth");
const { body, fail, dbError } = require("../lib/http");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const u = await currentUser(req);
    if (!u) return fail(res, 401, "login_required");
    if (req.method === "GET") {
      const [d] = await sql()`SELECT season, coach_history FROM user_data WHERE user_id = ${u.id}`;
      return res.status(200).json({ season: d ? d.season : {}, coachHistory: d ? d.coach_history : [] });
    }
    if (req.method === "PUT") {
      const season = body(req).season;
      if (!season || typeof season !== "object" || JSON.stringify(season).length > 300000) return fail(res, 400, "bad_request");
      await sql()`INSERT INTO user_data (user_id, season, updated_at) VALUES (${u.id}, ${JSON.stringify(season)}::jsonb, now())
        ON CONFLICT (user_id) DO UPDATE SET season = EXCLUDED.season, updated_at = now()`;
      return res.status(200).json({ ok: true });
    }
    return fail(res, 405, "method");
  } catch (e) { return dbError(res, e); }
};
