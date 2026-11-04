# AMR Exclusive engagement V1 — backend integration contract

The frontend is staged only. It **does not** provide public counters until an owner-approved HTTPS backend is configured using `window.AMR_ENGAGEMENT_ENDPOINT` before `engagement.js`. Do not merge until backend and integration tests pass.

## API
For video ID `enuk`:
- `GET /videos/enuk` -> `{"likes":0,"views":0}`
- `PUT /videos/enuk/like` with `{"visitorKey":"uuid"}` -> updated totals
- `DELETE /videos/enuk/like` with same payload -> updated totals
- `POST /videos/enuk/view` with `{"visitorKey":"uuid","qualifiedSeconds":3}` -> updated totals

All responses must be JSON with nonnegative integer `likes` and `views`. CORS must allow the AMR site origin and methods GET/PUT/DELETE/POST. No secret tokens in public JS.

## Required backend protections
- Atomic increments and decrements; idempotent per-visitor Like state and qualified view deduplication.
- Server-side validation, rate limits, origin checks, and bot mitigation. Never trust client-reported seconds as proof of watching.
- Anonymous visitor keys are weak identifiers and may be cleared, forged or duplicated; do not promise exact unique viewers or one Like per human.
- Establish privacy/retention policy for visitor keys and IP metadata; minimize collected data.
- Never substitute GoatCounter pageviews for qualified plays.
- Configure health checks and test on mobile/desktop before release.

## Current limitations
The static GitHub Pages frontend cannot securely persist global counters by itself. The UI fails closed with unavailable labels. Backend selection, deployment, CORS, real persistence, and end-to-end tests remain pending.
