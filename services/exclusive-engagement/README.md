# AMR Exclusive counters — staged Cloudflare Worker + D1

This is an **undeployed** candidate backend. Do not publish until owner approves a Cloudflare account/database, confirms costs, and validates the complete flow.

## Provisioning (owner approval required)
1. Create a Cloudflare D1 database named `amr-exclusive-engagement`.
2. Fill the real D1 binding in `wrangler.toml`; do not commit account secrets.
3. Apply `schema.sql` to D1.
4. Configure `VISITOR_HASH_SECRET` using a secret (never in GitHub).
5. Deploy Worker under an HTTPS endpoint, then configure `window.AMR_ENGAGEMENT_ENDPOINT` before the page's engagement script.
6. Confirm CORS on the production origin, real Like/unlike persistence, qualified plays, mobile playback and browser errors.

## Counting semantics
- Likes: one active Like per locally generated anonymous visitor UUID and film; toggling is idempotent.
- Views: one qualified event per UUID, film, and UTC day, after the browser reports 3 seconds of sequential playback.
- Counters are independent of Facebook and YouTube. A visitor can clear storage or forge requests; this is **not** one-per-human, proof-of-watch, or bot-proof.
- Request-rate limiting is approximate; investigate stronger bot protection if abuse occurs.
- Visitor UUIDs and IPs are HMAC-hashed server-side. Rate-limit records require periodic cleanup and a documented retention policy.
- Keep the worker's allowlist updated when adding a new AMR Original.

## Release blockers
- Confirm Cloudflare D1 billing and limits; this code does not provision an account.
- Validate API error paths, CORS preflight, replay/refresh, mobile playback, and rate limits.
- Implement retention cleanup for rate_events and privacy disclosure.
- Verify that existing Enuk player and featured Laestrygonians routes work end-to-end.
- Test against a nonproduction D1 database first.
