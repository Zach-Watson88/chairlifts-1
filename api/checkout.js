// Stripe Checkout for Chairlift Pro ($4.99/month subscription).
// POST /api/checkout                 -> { url }  (redirect the browser there)
// GET  /api/checkout?session_id=...  -> confirms payment and turns on Pro -> { user }
// Needs STRIPE_SECRET_KEY in Vercel. Optional: PRO_PRICE_CENTS (default 499).
const Stripe = require("stripe");
const { sql } = require("../lib/db");
const { currentUser, publicUser } = require("../lib/auth");
const { fail, dbError, origin } = require("../lib/http");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const u = await currentUser(req);
    if (!u) return fail(res, 401, "login_required", "Log in first, then upgrade.");
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return fail(res, 503, "no_stripe", "Payments aren't switched on for this site yet.");
    const stripe = new Stripe(key);

    if (req.method === "POST") {
      if (u.is_pro) return fail(res, 409, "already_pro", "You already have Chairlift Pro.");
      const cents = parseInt(process.env.PRO_PRICE_CENTS || "499", 10);
      const base = origin(req);
      const s = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cents,
            recurring: { interval: "month" },
            product_data: { name: "Chairlift Pro", description: "Unlimited AI Riding Coach analyses, saved coaching history and season stats." },
          },
        }],
        customer_email: u.email,
        client_reference_id: String(u.id),
        metadata: { user_id: String(u.id) },
        success_url: `${base}/?checkout=success&session_id={CHECKOUT_SESSION_ID}#account`,
        cancel_url: `${base}/?checkout=cancel#account`,
      });
      return res.status(200).json({ url: s.url });
    }

    if (req.method === "GET") {
      const id = String((req.query || {}).session_id || "");
      if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return fail(res, 400, "bad_request");
      const s = await stripe.checkout.sessions.retrieve(id);
      const paid = s.status === "complete" && (s.payment_status === "paid" || s.payment_status === "no_payment_required");
      if (s.client_reference_id !== String(u.id) || !paid) return fail(res, 402, "not_paid", "That payment didn't go through.");
      const [nu] = await sql()`UPDATE users SET is_pro = true, pro_since = COALESCE(pro_since, now()),
        stripe_customer_id = ${s.customer || null}, stripe_subscription_id = ${s.subscription || null}
        WHERE id = ${u.id} RETURNING *`;
      return res.status(200).json({ user: publicUser(nu) });
    }
    return fail(res, 405, "method");
  } catch (e) {
    if (e && e.type && String(e.type).startsWith("Stripe")) { console.error(e); return fail(res, 502, "stripe_error", e.message); }
    return dbError(res, e);
  }
};
