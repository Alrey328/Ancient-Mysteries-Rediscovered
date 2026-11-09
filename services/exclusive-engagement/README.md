# AMR Exclusive engagement — Cloudflare Worker + D1

This service owns anonymous Like totals and qualified View totals for AMR-hosted original films. The Phase B branch additively extends it with Google-authenticated membership, member Likes, native comments, moderation, account deletion, notification consent, and release-email delivery. It remains intentionally independent of Facebook, YouTube, and GoatCounter.

The complete membership architecture, configuration, privacy model, cost thresholds, and approval gates are documented in [`../../docs/amr-membership-v1.md`](../../docs/amr-membership-v1.md). The production Worker and D1 database must not receive the membership migration or code until the owner separately approves Phase D.

## Existing resources

- Worker: `amr-exclusive-engagement`
- URL: `https://amr-exclusive-engagement.belizean328.workers.dev`
- D1 database and binding: `amr-exclusive-engagement` as `DB`
- D1 database ID: recorded in `wrangler.toml`
- Secret: `VISITOR_HASH_SECRET` must exist as a Cloudflare Worker secret and must be at least 32 characters. Never store or print its value.

Do not replace this production resource. Phase B uses a separate preview Worker and separate preview D1 database from `wrangler.preview.toml.example`. Do not enable a paid plan, paid overages, or a trial that converts to paid.

## Safe validation and deployment

From this directory:

```sh
npm test
npx wrangler d1 execute amr-exclusive-engagement --local --file schema.sql
npx wrangler dev --local
```

The local schema includes the additive membership tables. For a hosted preview, copy `wrangler.preview.toml.example` to an ignored `wrangler.preview.toml`, fill only preview resource IDs/origins, configure preview-only secrets, and deploy with `--config wrangler.preview.toml`. Keep `NOTIFICATION_MODE=preview`; do not configure a Resend key.

Remote inspection and all writes require the owner's Cloudflare login. Before deployment, verify the account is on Workers Free and the existing binding is named exactly `DB`. Applying `schema.sql` is idempotent and migrates the earlier event tables to indexed, trigger-maintained totals.

Only after explicit Phase D owner approval:

```sh
npx wrangler d1 execute amr-exclusive-engagement --remote --file schema.sql
npx wrangler secret put VISITOR_HASH_SECRET
npx wrangler deploy
```

The membership release additionally requires `migrations/0002_membership.sql`, independent session/identity/unsubscribe/release secrets, Google client configuration, Turnstile, the final API origin, and Resend. Follow the ordered runbook in the membership document; do not run this older all-in-one schema command against production as a substitute for the reviewed migration.

Generate a new high-entropy secret locally and paste it only into Wrangler's hidden prompt. Never put the value on a command line. Rotating the secret breaks association with prior anonymous visitor hashes, so treat rotation as an operational migration.

## Counting and privacy semantics

- Likes: one active Like per locally generated anonymous UUID and film; PUT/DELETE are idempotent.
- Views: one View per UUID, film, and UTC day after at least three seconds of actual progressive playback.
- The browser UUID is HMAC-hashed before D1 storage. Cloudflare's connecting IP is separately HMAC-hashed and retained only in minute rate-limit buckets.
- Rate-limit buckets expire after 48 hours through sampled indexed cleanup.
- No raw IP address, account identity, email, or secret is stored.
- Clearing storage, changing devices, or forging requests can create additional anonymous identities. These are engagement indicators, not audited unique-person metrics.

## Free-tier behavior

Counter reads are point lookups from `engagement_totals`, avoiding repeated `COUNT(*)` scans. Database triggers keep totals synchronized only when an idempotent insert/delete actually changes a row. Mutation traffic is rate-limited to 6 view attempts or 10 Like operations per IP per minute. If the Worker, D1, network, or free quota is unavailable, the static video continues to play and only the counters degrade.

The video allowlist and `engagement_totals` seed rows must both be extended when a new AMR Original is released.
