# AMR Studio V1 production release system

## Audit of PR #47

PR #47 is a useful, isolated Studio prototype, not a production publisher. Its reusable parts are:

- server-side passphrase authentication and signed `HttpOnly`, `Secure`, `SameSite=Strict` sessions;
- same-origin checks on every mutation, login throttling, restrictive browser headers, and `noindex`;
- D1-backed metadata editing;
- validated private MP4/poster uploads and authenticated byte-range playback;
- protected previews and a 10-test security/regression suite.

The original production blockers were the isolated test-only D1/R2 bindings, a 50 MB single-upload ceiling, duplicated film data across Cinema/Exclusives/homepage pages, no owner authorization handoff, no GitHub Pages integration, and no rollback procedure. The prototype also had three uncommitted follow-up fixes: fixed-length R2 streaming, safer draft/file UI state, and additional editor tests. Those behaviors are incorporated here.

Current `main` had advanced from PR #47's base (`389f415`) through PR #57. The Studio files did not conflict at the Git level, but the release system did: Sirens, Land of the Dead, Laestrygonians, and Enuk were hand-maintained in multiple HTML/JSON locations. This implementation keeps one Studio service and one production manifest rather than creating another prototype.

## Canonical publishing architecture

`data/cinematic-releases.json` is the only editable production film manifest. It owns:

- film identity, titles, descriptions, release dates, durations, discussions, and optional engagement IDs;
- exact production video/poster references, byte counts, and SHA-256 hashes;
- Cinema, Exclusives, and homepage placement;
- `prepared` versus `published` state;
- the single owner-selected homepage feature.

`scripts/cinematic-release.mjs` validates media integrity and generates:

- the public manifest;
- Cinema collection and individual film pages;
- the Exclusives library;
- the homepage `featuredOriginal` record;
- sitemap film routes.

`npm run cinema:check` fails if any generated output drifts from the canonical manifest. Prepared films are intentionally excluded from every public output.

## Owner-authorized release procedure

1. In protected Studio, save metadata, upload the MP4 and poster, and verify the private preview.
2. Enter exact production asset paths/HTTPS URLs, byte counts, SHA-256 hashes, duration, date, and whether the film is requested as the homepage feature.
3. Select **Prepare owner approval request**. Studio stores and returns a digest-bound `prepared` manifest entry. This does not write to production.
4. Add that prepared entry and any approved repository media in a focused draft pull request. Run `npm run cinema:apply`, `npm test`, and `npm run cinema:check`.
5. The owner reviews the exact assets, manifest diff, generated plan, costs, and preview. Merge the prepared PR only when it is complete. The film remains absent from public outputs after this merge.
6. Record the SHA-256 of `data/cinematic-releases.json` on `main`.
7. Run **Actions → Cinematic release gate → Run workflow** with:
   - the exact film slug;
   - the recorded manifest SHA-256;
   - `yes` or `no` for homepage feature;
   - the exact confirmation `PUBLISH <slug>`.
8. The workflow verifies the hash, changes only that film to `published`, regenerates every placement, runs the complete test suite, and pushes one atomic commit to `main`. A mismatch or failed test pushes nothing.
9. Wait for the existing GitHub Pages deployment and complete the live verification checklist below.

Production credentials never enter browser code. Studio uses only server-side Worker secrets. The production publish gate uses GitHub's short-lived Actions token with repository-scoped `contents: write` permission.

## Rollback and failed-release recovery

The production release is one Git commit. To roll it back, use GitHub's **Revert** action on the `Publish cinematic: <slug>` commit (or open a focused revert PR), merge the revert, wait for Pages, and repeat live verification. The revert restores the previous manifest, homepage selection, pages, links, and sitemap together.

Do not delete media during rollback. Keep it until the corrected release is live and verified. If the owner gate fails before its commit, no rollback is needed: fix the prepared manifest/asset issue in a new PR, record the new manifest hash, and rerun the manual gate. Never force-push or partially edit generated files on `main`.

## Live release verification

For the released slug, verify against `https://ancientmysteriesrediscovered.com/`, not only a staging URL:

- Cinema collection and `/cinema/<slug>/` title, poster, metadata, share URL, comments term, and playback;
- Exclusives card, poster, link, and playback;
- homepage placement exactly matches the owner's `yes`/`no` choice;
- MP4 and poster return the intended MIME type and exact byte count; compare SHA-256 when downloading for release QA;
- play, pause, seek, audio, captions, native controls, and fullscreen on desktop and a real/mobile-emulated narrow viewport;
- every previously published film remains linked and playable;
- no autoplay, horizontal overflow, broken navigation, or unexpected engagement-ID changes;
- GitHub Pages deployment is successful and the live commit is the owner-authorized publish commit.

## Storage limits and cost decision (reviewed November 17, 2026)

No Cloudflare resource is created or enabled by this change.

- GitHub blocks regular repository files over 100 MiB, recommends repositories stay under 1 GB, limits a published Pages site to 1 GB, and applies a soft 100 GB/month Pages bandwidth limit. The current repository is already media-heavy, so GitHub is appropriate only for smaller approved films.
- Cloudflare Free/Pro requests are limited to 100 MB. Studio therefore uses authenticated R2 multipart uploads in 25 MB parts for large MP4s, with a 10,000-part (about 244 GiB) application cap. R2 supports multipart objects up to 5 TiB; failed parts can be retried without restarting the whole file.
- R2 Standard includes 10 GB-month storage, 1 million Class A operations, and 10 million Class B operations monthly. Above that: $0.015/GB-month, $4.50/million Class A, $0.36/million Class B, with no Internet egress charge. Enabling R2 requires completing Cloudflare's R2 subscription checkout even when usage stays in the included tier.
- D1 Free includes 5 million rows read/day, 100,000 rows written/day, 5 GB total storage, and 10 databases. Free-tier limits stop queries rather than creating overage charges. D1 is metadata only; video bytes never belong in D1.

Official references: [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 multipart uploads](https://developers.cloudflare.com/r2/objects/upload-objects/), [R2 multipart Workers API](https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/), [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [GitHub large-file limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github), and [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## Owner decisions still required

1. Approve or decline enabling the existing Cloudflare account's R2 subscription, private Studio bucket, production media bucket/custom domain, D1 database, and Cloudflare Access policy. Until approved, use local Studio plus repository media that remains within GitHub/Pages limits.
2. Decide whether this integration PR should keep Sirens as the homepage featured cinematic. The manifest currently proposes **yes** to match the existing Sirens homepage feature work; change `homepageFeaturedSlug` before merge if the answer is no.
3. Confirm the GitHub Actions manual publish workflow may write its single tested release commit to `main`, and retain required owner/reviewer protections.
4. Approve the Studio hostname and two strong Worker secrets before any remote Studio deployment.

## Commands

```powershell
npm run cinema:apply
npm run cinema:check
npm test
node scripts/verify-sirens-media.mjs
```
