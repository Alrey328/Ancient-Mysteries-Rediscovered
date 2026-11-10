# AMR Cinema V1 architecture

## Reused production systems

- `/cinema/` is a direct featured-film viewing route: title, playable film, share controls, consent-based discussion, then inline recommendations. One Play activation starts each featured or recommended film in place; dedicated film selections use the same uninterrupted layout.
- Film media stays on the existing static site: `media/Enuk_AMR_Exclusive_web.mp4`, `assets/originals/laestrygonians/film.mp4`, and `assets/originals/land-of-the-dead/film.mp4`.
- Existing posters, film IDs, and film routes remain unchanged. Land of the Dead uses a dedicated Cinema route and self-hosted assets, without a YouTube dependency.
- Enuk and Laestrygonians viewing pages continue to load `exclusives/engagement.js` with their existing IDs. Their Likes and qualified Views therefore keep using the existing Worker, D1 records, visitor key, rate limits, and three-second view qualification. Land of the Dead does not add a production Worker allowlist or D1 migration in this Cinema-only release.
- Comments reuse the repository's existing Giscus configuration and GitHub Discussions category. Cinema uses stable film-specific terms so the featured and dedicated Laestrygonians routes share one thread instead of splitting the conversation by pathname.
- Existing Exclusives pages remain intact and are the canonical URLs for Enuk and Laestrygonians. Their Cinema viewing routes are alternate presentation URLs. Land of the Dead has no separate Exclusives page, so `/cinema/land-of-the-dead/` is its stable canonical film URL and appears in the sitemap alongside `/cinema/`.

## Comment system decision

### V1: existing Giscus integration

Giscus is the safest zero-infrastructure implementation available in the current repository. It supplies persistent comments, replies, reactions, GitHub spam controls, abuse reporting, moderation, locking, and deletion without adding a database or secret. It remains a transitional solution because viewers need a GitHub account to comment. Watching and liking continue to require no account.

Privacy and operations:

- The Giscus client and GitHub receive request and account data when the comment area loads or a viewer signs in.
- AMR moderators manage comments through GitHub Discussions.
- Availability depends on GitHub, Giscus, repository Discussions, and the configured category.
- Expected recurring infrastructure cost: $0.

### Recommended general-audience evolution

When the owner approves a native comment backend, extend `amr-exclusive-engagement` rather than create a second Worker or database. Add comment, report, and moderation tables to the existing D1 database and expose narrowly scoped endpoints from the existing Worker.

Recommended identity flow:

1. Create an AMR-owned Google OAuth web client with only production and explicitly authorized preview origins.
2. Use Google Identity Services in the browser to obtain an ID token after an intentional sign-in action.
3. Send the token to the Worker over HTTPS. Never place a client secret or D1 credential in browser code.
4. Verify the token signature against Google's JWKS and validate issuer, audience, expiry, and nonce server-side.
5. Store a keyed pseudonymous account identifier, display name, avatar URL if approved, comment body, moderation state, and timestamps. Do not store Google access tokens.
6. Require authorization for edit/delete operations; provide report endpoints, moderator roles, rate limits, content length limits, output escaping, audit records, and retention rules.

Security and operational requirements:

- Add a `GOOGLE_CLIENT_ID` configuration value and separate moderation authorization secrets through Cloudflare secrets or bindings.
- Use strict production CORS, CSRF-resistant token validation, schema validation, abuse throttling, and generic error responses.
- Establish a privacy notice, community rules, deletion-request process, moderator workflow, and escalation policy before launch.
- Test D1 query plans and retention against the Workers/D1 Free allowances. Expected recurring platform cost can remain $0 at current AMR scale, but traffic and database usage must be monitored.
- Native comments are intentionally not implemented or deployed in Cinema V1 without a separate schema, OAuth, privacy, and production authorization review.

## Preview limitation

The production engagement Worker permits only AMR production origins. A protected Vercel preview can render and play both films, but live browser engagement calls require a temporary exact `PREVIEW_ORIGIN` Worker configuration. That change needs separate owner authorization and must be removed after testing. Unit/static tests verify that Cinema reuses the existing endpoint and IDs without changing Worker code.
