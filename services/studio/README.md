# AMR Studio V1 prototype

AMR Studio is an isolated Cloudflare Worker prototype for uploading an MP4 and poster, saving film metadata, previewing the result, and toggling a test-only published state. It does not write to the production website, production database, or the existing engagement service.

## Architecture

- One plain JavaScript Cloudflare Worker; no new frontend framework.
- A dedicated D1 database stores draft metadata and status.
- Dedicated private R2 buckets store MP4 and poster objects.
- Every Studio, asset, and preview route requires a server-signed `HttpOnly` session.
- Mutations require an exact same-origin request. Uploads enforce declared size, MIME type, and file signatures.
- The test viewer is `noindex` and remains behind the same Studio authorization.

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

## Isolated preview setup

1. Create a new D1 database named `amr-studio-v1-test` and two private R2 buckets named `amr-studio-v1-test` and `amr-studio-v1-preview`.
2. Replace only the documented local placeholder D1 ID in `wrangler.toml` with the new test database ID.
3. Apply `migrations/0001_studio.sql` to the test database.
4. Add strong `STUDIO_ADMIN_PASSWORD` and `SESSION_SECRET` Worker secrets. Generate the session secret with a password manager or at least 32 random bytes.
5. Deploy this Worker under a test-only name. Do not route the production AMR domain to it and do not bind production D1/R2 resources.
6. Add Cloudflare Access in front of the Worker for a second authentication layer before sharing a preview URL.

No deployment is performed by this prototype branch.

## Validation

```powershell
cd services/studio
npm test
```

The tests cover authorization, same-origin mutation checks, draft CRUD, file signature and size validation, private asset delivery, publish/unpublish rules, and security headers.
