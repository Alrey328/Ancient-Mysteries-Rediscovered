# AMR Cinema membership and notifications V1

Status: Phase B implementation. Preview-only. Production activation is prohibited until separate Phase C approval.

## Architecture decision

V1 extends the existing static GitHub Pages Cinema and the existing Cloudflare Worker/D1 engagement service instead of introducing another application stack.

- **Frontend:** existing static Cinema pages, with a small shared membership client and My AMR page.
- **Identity:** Google Identity Services for web. The browser receives an ID credential; the Worker verifies its RS256 signature, issuer, audience, expiry, nonce, and verified-email claim.
- **Sessions:** opaque 256-bit session tokens. Only an HMAC hash is stored in D1. Production uses a Secure, HttpOnly cookie; a bearer token is returned only when `PREVIEW_MODE=true` so a cross-site preview can be inspected without weakening production cookies.
- **Data/API:** the existing Cloudflare Worker and D1 database, using additive tables and triggers. Existing anonymous Like and qualified View tables and totals remain the source of truth.
- **Spam control:** authenticated posting, existing per-IP mutation limits, length validation, report/moderation endpoints, and optional Cloudflare Turnstile.
- **Email:** Resend transactional API, called only by the Worker when `NOTIFICATION_MODE=live`. Preview records deliveries but never calls Resend.
- **Release trigger:** a disabled-by-default GitHub Actions workflow submits only manifest entries marked `published`, after a successful GitHub Pages production deployment. Worker idempotency prevents duplicate release sends.
- **Earlier discussions:** Giscus remains embedded under “Earlier GitHub discussion”; no GitHub Discussion is changed or deleted.

## Phase B isolation

The preview must use all three of the following:

1. A separate Worker named `amr-exclusive-engagement-preview`.
2. A separate D1 database named `amr-exclusive-engagement-preview`.
3. `PREVIEW_MODE=true` and `NOTIFICATION_MODE=preview`.

`cinema/runtime-config.js` routes localhost to `127.0.0.1:8787`, any non-production HTTPS hostname to the preview Worker, and only `ancientmysteriesrediscovered.com`/`www` to the current production engagement endpoint. This prevents a Vercel preview from reading or writing production D1.

The checked-in `wrangler.preview.toml.example` is a template only. It contains no resource ID or secret and cannot be deployed until copied to an ignored `wrangler.preview.toml` and completed.

## Data preservation and migration

`migrations/0002_membership.sql` is additive. It does not rename, truncate, update, or delete any existing table or engagement row. It adds:

- `members` and `member_sessions`;
- `member_likes`, whose triggers increment/decrement the existing `engagement_totals.likes` value;
- `comments` and `comment_reports`;
- `notification_preferences`, `release_events`, and `notification_deliveries`;
- `moderation_audit`.

On first Google sign-in, a valid anonymous visitor key may be claimed. The Worker inserts a member Like, removes the matching anonymous Like in one D1 batch, and leaves the aggregate total unchanged. A user without a matching anonymous Like does not affect existing totals.

Before any production migration in Phase D:

1. Export the production D1 database and record its Time Travel bookmark.
2. Record row counts and `SUM(likes)`, `SUM(views)` from `engagement_totals`.
3. Apply only `migrations/0002_membership.sql` remotely.
4. Repeat row-count and aggregate checks; they must be identical.
5. Run read-only integrity checks before deploying Worker code.

No production migration was applied during Phase B.

## Privacy and deletion policy

Stored member data is limited to email, display name, optional Google-hosted avatar URL, a pseudonymous HMAC of Google subject ID, consent flags/timestamps, and service activity. Raw Google subject IDs, Google access tokens, passwords, raw IPs, and OAuth client secrets are not stored.

Account deletion is authenticated and cascades to sessions, preferences, member Likes, comments, reports, and notification delivery records. The public aggregate Like total is adjusted by database triggers. Existing anonymous engagement and Giscus content are outside the membership account and are not deleted. Moderation audit rows retain no email and set the deleted moderator reference to null.

## Notification safeguards

- All three preferences begin unchecked and false.
- Only members whose category preference was enabled before the release `publishedAt` are queued; this blocks join-time backlog.
- Draft/unpublished manifest entries are ignored by the trigger and rejected by the Worker.
- `(member_id, release_id)` is unique, queue claims are atomic, and Resend receives a stable idempotency key, preventing duplicates on retries, overlapping cron runs, or redeploys.
- Unsubscribe tokens are HMAC-signed, versioned, and invalidate older links after use.
- Messages include visible unsubscribe text plus `List-Unsubscribe` and `List-Unsubscribe-Post` headers.
- Preview mode queues test records only and the scheduled sender exits before calling Resend.
- The GitHub workflow is inert until the protected production environment, repository variable, API origin, and secret are configured.

## Configuration requirements

### Google Cloud

Create one Web OAuth client for production and one separate Web OAuth client for preview. Google Identity Services does not need a client secret in this credential flow.

Production authorized JavaScript origins:

- `https://ancientmysteriesrediscovered.com`
- `https://www.ancientmysteriesrediscovered.com`

Preview origins must be exact HTTPS origins. Because Vercel creates changing branch/commit hosts, use a stable preview alias or update the preview OAuth client and `PREVIEW_ORIGINS` to the current exact host. Add localhost origins only to a development-only client.

Set the public Web client ID in the relevant Cinema meta tag and the identical value in `GOOGLE_CLIENT_ID` on its Worker. This ID is public by design; no Google secret belongs in frontend code.

### Cloudflare Worker

Plain variables:

| Name | Preview | Production |
|---|---|---|
| `GOOGLE_CLIENT_ID` | preview Web client ID | production Web client ID |
| `PREVIEW_MODE` | `true` | `false` or omitted |
| `NOTIFICATION_MODE` | `preview` | `off` until Phase D, then `live` |
| `PREVIEW_ORIGINS` | exact preview origin(s), comma-separated | omit |
| `SESSION_COOKIE_SAMESITE` | `None` for cross-site preview | `Lax` after API custom domain is same-site |
| `TURNSTILE_REQUIRED` | `false` until preview widget configured | `true` before public posting |
| `API_ORIGIN` | preview Worker origin | final API custom origin |
| `EMAIL_FROM` | omit | e.g. `AMR Cinema <cinema@updates.ancientmysteriesrediscovered.com>` |

Worker secrets, each generated independently with at least 32 random bytes:

- `VISITOR_HASH_SECRET`
- `SESSION_HMAC_SECRET`
- `IDENTITY_HMAC_SECRET`
- `UNSUBSCRIBE_HMAC_SECRET`
- `RELEASE_WEBHOOK_SECRET`
- `TURNSTILE_SECRET_KEY` when Turnstile is required
- `RESEND_API_KEY` only in production after sender-domain verification and Phase D approval

Frontend public value: the Turnstile site key in the `amr-turnstile-site-key` meta tag. A secret key must never be present in HTML or JavaScript.

### GitHub

Create a protected environment named `amr-member-notifications-production`, requiring owner approval. Configure only after Phase D approval:

- repository variable `AMR_NOTIFICATIONS_ENABLED=true`;
- repository variable `AMR_API_ORIGIN=https://api.ancientmysteriesrediscovered.com`;
- environment secret `AMR_RELEASE_WEBHOOK_SECRET`, matching the Worker secret.

Until all three exist, the notification workflow does nothing. New release objects are added to `data/member-notification-releases.json` only in the same reviewed commit that publishes that release.

### Resend and DNS

Create a Resend account without enabling paid overages. Add a dedicated sending subdomain such as `updates.ancientmysteriesrediscovered.com`, then copy the exact SPF/DKIM records Resend generates into Cloudflare DNS after the DNS migration is approved. Configure DMARC monitoring before changing to enforcement. Do not send from the organizational root domain.

## Costs and thresholds (rechecked 2026-11-09)

| Service | V1 selection | Expected starting cost | Limit/upgrade trigger |
|---|---|---:|---|
| Cloudflare Workers | Free | $0/month | 100,000 requests/day and 10 ms CPU/invocation; Paid starts at $5/month if approved. |
| Cloudflare D1 | Free | $0/month | 5M rows read/day, 100k rows written/day, 5 GB total, 10 databases. |
| Cloudflare Turnstile | Free | $0/month | 20 widgets/account, 10 hostnames/widget, unlimited challenges. |
| Google Identity Services | Web sign-in | $0/month expected; no billable Google API is used | Google does not publish a separate GIS usage price on the setup pages. Do not enable Identity Platform or paid Google APIs; verify the project billing screen before activation. |
| Resend | Free transactional plan | $0/month | 3,000 emails/month and 100/day; Pro is $20/month for 50,000/month. Do not enable overages without owner approval. |
| GitHub Pages / Actions | existing repository plan | no incremental cost expected | Existing plan quotas apply. |
| Vercel preview | existing Git integration | no incremental cost expected | Existing account/team quotas apply. |

Pricing sources: [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/), [Cloudflare D1](https://developers.cloudflare.com/d1/platform/pricing/), [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/plans/), [Google Identity Services](https://developers.google.com/identity/gsi/web/guides/overview), and [Resend](https://resend.com/pricing). Prices and limits can change; recheck immediately before Phase D.

## Phase C acceptance checklist

- Owner can open a stable static preview URL and separate Worker health endpoint.
- Preview health says `notificationMode: preview`.
- Google sign-in succeeds with a preview-only Google client and exact preview origin.
- Anonymous playback works before sign-in and is not reset when the sign-in invitation opens.
- Anonymous Like claim, member Like/unlike, comment create/list/delete/report, preferences, unsubscribe, and deletion pass against preview D1.
- Preview notification test shows queued/deduplicated records and zero Resend calls.
- Android Chrome and iOS Safari-size layouts are visually approved.
- No production DNS, D1 schema, Worker, email, GitHub Discussion, merge, or deployment has changed.

Only after this checklist is reviewed should Phase C approval be requested. Phase D remains a separate approval gate.
