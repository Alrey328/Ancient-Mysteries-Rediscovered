# AMR Exclusives — Enuk pilot

Development-only. Do not merge until launch checks pass.

## Video asset
Upload the verified H.264/AAC Enuk file as `media/enuk-amr-exclusive.mp4` at the repository root (the player currently references this path). Do not publish a page with a broken video.

## Analytics
`exclusives/tracking.js` instruments page views, playback, progress, completion, share intent and explore-more clicks. It sends **nothing** until `window.AMR_ANALYTICS_ENDPOINT` is configured with a reviewed HTTPS collection service. The endpoint must support POST with JSON or Beacon payloads, aggregate anonymous events, avoid unnecessary identifiers, filter test traffic, and provide retention controls and a privacy notice. Do not claim live visitor tracking until this is configured and verified.

## Launch checks
1. Verify MP4 loads and plays with sound on mobile and desktop.
2. Confirm canonical and Open Graph URLs against the actual deployed site URL.
3. Provide a real thumbnail and video metadata only after the media URL works.
4. Configure and verify analytics with a test source tag.
5. Check site navigation and existing pages for regressions.
6. Keep this PR in draft until all checks pass.