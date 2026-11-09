# AMR Cinema V1 architecture

## Reused production systems

- `/cinema/` is a direct featured-film viewing route: title, playable film, engagement/share controls, consent-based discussion, then recommendations. Dedicated film selections use the same uninterrupted layout.
- Film media stays on the existing static site: `media/Enuk_AMR_Exclusive_web.mp4`, `assets/originals/laestrygonians/film.mp4`, and `assets/originals/land-of-the-dead/film.mp4`.
- Existing posters, film IDs, and film routes remain unchanged. Land of the Dead uses the new `land-of-the-dead` ID and a dedicated Cinema route.
- Cinema viewing pages load `exclusives/engagement.js` and use the allowlisted `enuk`, `laestrygonians`, and `land-of-the-dead` IDs. Likes and qualified views therefore use the existing Worker, D1 records, visitor key, rate limits, and three-second view qualification.
- Earlier discussions reuse the repository's existing Giscus configuration and GitHub Discussions category. Cinema uses stable film-specific terms so featured and dedicated routes for the same film share one thread instead of splitting the conversation by pathname.
- Existing Exclusives pages remain intact and are the canonical URLs for Enuk and Laestrygonians. Their Cinema viewing routes remain alternate presentation URLs. Land of the Dead has no separate Exclusives page, so `/cinema/land-of-the-dead/` is its stable canonical film URL and appears in the sitemap alongside `/cinema/`.

## Membership preview integration

The Phase B membership branch additively introduces Google-authenticated member Likes, native comments, profiles, and notification preferences. On Cinema pages, native comments appear first while the existing Giscus thread remains available under “Earlier GitHub discussion.” Preview hosts are routed to the separate preview Worker/D1 by `cinema/runtime-config.js`; no production membership or notification service is activated by these static pages.

Land of the Dead uses the same membership surface and the independent `land-of-the-dead` engagement ID. Production migration order is `0002_membership.sql` followed by the idempotent `0003_land_of_the_dead.sql` seed, only after explicit owner approval.

## Comment system decision

### V1: existing Giscus integration

Giscus is the safest zero-infrastructure implementation available in the current repository. It supplies persistent comments, replies, reactions, GitHub spam controls, abuse reporting, moderation, locking, and deletion without adding a database or secret. It remains a transitional solution because viewers need a GitHub account to comment. Watching and liking continue to require no account.

Privacy and operations:

- The Giscus client and GitHub receive request and account data when the comment area loads or a viewer signs in.
- AMR moderators manage comments through GitHub Discussions.
- Availability depends on GitHub, Giscus, repository Discussions, and the configured category.
- Expected recurring infrastructure cost: $0.

### Implemented in the Phase B preview

The membership preview extends `amr-exclusive-engagement` with comment, report, and moderation tables in a separate preview D1 database. Production activation remains prohibited until the membership approval gates are completed.

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
