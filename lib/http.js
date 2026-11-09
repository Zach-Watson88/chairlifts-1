// Small helpers shared by the API routes.
function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}
function fail(res, status, error, message = "") {
  return res.status(status).json({ error, message });
}
function dbError(res, e) {
  if (e && e.code === "no_db") return fail(res, 503, "no_db", "The database isn't connected yet.");
  console.error(e);
  return fail(res, 500, "server", "Something went wrong on our side.");
}
function origin(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}
module.exports = { body, fail, dbError, origin };
