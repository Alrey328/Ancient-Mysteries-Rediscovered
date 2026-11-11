# AMR Living Gallery · Phase 1 (isolated draft)
This draft adds `/3d/` and `/3d/gigantes/` without touching the homepage, Cinema, other exhibits, engagement, DNS, or the sitemap.

## Source assets
- `assets/3d/gigantes/canva-poster.jpg`: the original Canva-rendered Gigantes image recovered from the AMR interactive-depth prototype.
- `assets/3d/gigantes/wavespeed-depth.png`: its exact matching WaveSpeed grayscale depth map, not a generated substitute.
- Original pair came from `Gigantes_Interactive_3D_Viewer.html` in the user's saved AMR files.

## Behavior
- Zero third-party JavaScript or paid API; WebGL1 parallax shader uses two static images.
- Entire flattened scene shifts at constrained angles; NOT a true 360-degree model.
- Mouse hover, finger drag, reset, original-image comparison, controlled depth strength, optional drift, and permission-gated phone sensor tilt.
- Graceful image fallback when WebGL or images fail. Motion preferences disable auto drift.
- Page is `noindex,nofollow` until launch approval. No site navigation link yet; deep link only.
- Device/browser QA is required before merge, especially Samsung/Android rendering, motion permissions, and distorted edges.

## Test
Run `cd services/exclusive-engagement && npm test` to include the Living Gallery static regression checks. For a manual smoke test open `/3d/gigantes/` in a WebGL-capable browser and switch original/3D, drag, reset, adjust strength, then rotate the device.

## Launch gating
After successful owner review only: remove prelaunch noindex, consider adding the gallery to the Relics area, add sitemap entry, then merge in a separate explicitly approved action.
