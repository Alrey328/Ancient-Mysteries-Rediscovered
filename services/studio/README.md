# AMR Studio V1

AMR Studio is a protected Cloudflare Worker for preparing cinematic releases. It saves film metadata, validates private media, previews the result, supports resumable multipart MP4 uploads, and produces a digest-bound owner approval request. It cannot directly publish to the public website.

## Architecture

- One plain JavaScript Cloudflare Worker; no new frontend framework.
- A dedicated D1 database stores draft metadata, multipart-upload state, and owner approval requests.
- Dedicated private R2 buckets store MP4 and poster objects.
- Every Studio, asset, and preview route requires a server-signed `HttpOnly` session.
- Mutations require an exact same-origin request. Uploads enforce declared size, MIME type, and file signatures. MP4s over 50 MB use authenticated 25 MB R2 multipart parts so they can exceed the Worker's single-request ceiling safely.
- The viewer is `noindex` and remains behind the same Studio authorization.
- Production asset references and SHA-256 values are included in the approval package; no GitHub or R2 credential is sent to the browser.

## Local setup

Prerequisites: Node.js 22+ and a Cloudflare account only when testing remote resources.

```powershell
cd services/studio
npm install
npm run dev
```

For local-only work, put non-production values in `.dev.vars` (it is ignored by the repository):

```text
STUDIO_ADMIN_PASSWORD=use-a-long-test-passphrase
SESSION_SECRET=use-at-least-32-random-characters-here
STUDIO_AUTO_MIGRATE=true
```

`STUDIO_AUTO_MIGRATE` is a local convenience only; omit it from remote environments and apply the checked-in migration instead. Then open the local URL printed by Wrangler. Use only disposable test media.

## Remote setup (owner approval required)

Do not perform these steps until the owner approves the Cloudflare resources and R2 subscription.

1. Create a D1 database and private R2 bucket dedicated to Studio drafts. A separate production bucket/custom domain is required only if the owner approves R2 for public large-video delivery.
2. Replace only the documented local placeholder D1 ID in `wrangler.toml` with the new test database ID.
3. Apply `migrations/0001_studio.sql` to the test database.
4. Add strong `STUDIO_ADMIN_PASSWORD` and `SESSION_SECRET` Worker secrets. Generate the session secret with a password manager or at least 32 random bytes.
5. Deploy this Worker under a test-only name. Do not route the production AMR domain to it and do not bind production D1/R2 resources.
6. Add Cloudflare Access in front of the Worker for a second authentication layer before sharing a preview URL.

No deployment or Cloudflare resource creation is performed by this branch.

## Validation

```powershell
cd services/studio
npm test
```

The tests cover authorization, same-origin mutation checks, draft CRUD, file signature and size validation, private asset delivery, multipart initialization, owner-gated release packages, preview status, and security headers.

See `docs/amr-studio-v1-production.md` for the canonical manifest, production release, live verification, cost, and rollback procedure.
