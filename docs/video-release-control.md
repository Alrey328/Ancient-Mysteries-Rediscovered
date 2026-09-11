# Ancient Mysteries Rediscovered — Video Release Control

This system lets the site owner change a companion video's public state without editing HTML.

## Owner workflow

Open **GitHub → Ancient-Mysteries-Rediscovered → Actions → Video Release Control → Run workflow**.

Choose a state:

- **off** — no public video module.
- **coming-soon** — public Coming Soon treatment; no unreleased URL is stored in the public release registry.
- **live** — public Watch the Story treatment links to the supplied Facebook/YouTube URL.
- **scheduled** — Coming Soon until the supplied ISO-8601 release time, then the public browser renders the Live treatment automatically.

## Security boundary

This repository is public. A URL or media file committed here is public even when HTML/JavaScript hides it. For that reason, OFF and COMING SOON explicitly remove `videoUrl` from the public registry.

**Preview is intentionally not implemented as a public-repository state.** Secure preview requires the unreleased media/URL to live behind authentication (for example a private storage service or private repository with an authenticated preview surface). Do not add a `preview` state that merely hides a public URL with CSS or JavaScript.

## Page integration

A page opts in by loading:

```html
<link rel="stylesheet" href="/assets/video-release.css">
<script defer src="/assets/video-release.js"></script>
```

and placing a release host where the video card belongs:

```html
<div class="amr-video-release"
     data-video-release-id="goliath-of-gath"
     data-video-title="Goliath of Gath"
     data-video-poster="/mysteries/goliath-of-gath/goliath-investigation-poster.png"
     hidden></div>
```

The ID must match the ID entered in the workflow.

## Scheduling

Use an explicit offset. Chicago daylight time example:

`2026-09-13T09:00:00-05:00`

The public module evaluates the scheduled timestamp when the page loads. No manual release-day edit is required.
