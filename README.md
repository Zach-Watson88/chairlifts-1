# Chairlift

Chairlift by Zach Watson: a ski and snowboard web app for college riders in the Northeast.
Mountain status for 57 mountains, GPS run and season tracking, mountain reviews, and the
**AI Riding Coach**, which turns a short phone video of your run into a technique breakdown with drills.

Live: https://chairlifts-1.vercel.app

## How it's built
- `index.html` — the whole front end (no build step)
- `api/` — Vercel serverless functions
  - `auth.js` sign up / log in / log out (sessions in an HttpOnly cookie)
  - `coach.js` AI Riding Coach (Claude Haiku 5.5 with image input)
  - `checkout.js` Stripe Checkout for Chairlift Pro ($4.99/month)
  - `data.js` per-user season log and coaching history
  - `reviews.js` mountain ratings and reviews
- `lib/` — Neon database setup, sessions, helpers. Tables are created automatically on first request.

## Environment variables (Vercel → Settings → Environment Variables)
| Name | What it is |
|---|---|
| `DATABASE_URL` | Neon Postgres connection (added automatically when you connect Neon in Vercel Storage) |
| `ANTHROPIC_API_KEY` | Anthropic API key for the AI coach |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...` for testing) |
| `PRO_PRICE_CENTS` | Optional. Pro price in cents, default `499` |

Keys live only in Vercel, never in this repo.

## Demo account
`demo@demo.com` / `password123!` — created automatically with full Pro access.
