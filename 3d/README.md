# AMR Living Gallery · isolated draft
This stacked draft provides `/3d/`, `/3d/gigantes/`, `/3d/odysseus/`, and `/3d/sirens/` without touching the homepage, Cinema, engagement, analytics, DNS, or the sitemap.

## Source assets
- `assets/3d/gigantes/canva-poster.jpg`: the original Canva-rendered Gigantes image recovered from the AMR interactive-depth prototype.
- `assets/3d/gigantes/wavespeed-depth.png`: its exact matching WaveSpeed grayscale depth map, not a generated substitute.
- Original pair came from `Gigantes_Interactive_3D_Viewer.html` in the user's saved AMR files.
- `assets/3d/sirens/canva-poster.png`: the exact 1024×1536 Sirens handoff poster.
- `assets/3d/sirens/wavespeed-depth-16bit.png`: its exact 1024×1536, 16-bit grayscale depth map (light is near, dark is far).
- The approved 1264×1264 Odysseus pair remains required at `assets/3d/odysseus/`; its route stays fail-closed until those originals are available.

## Behavior
- Zero third-party JavaScript or paid API. Existing 8-bit exhibits retain the WebGL1 path. Sirens parses its PNG scanlines and uploads native unsigned 16-bit samples to a WebGL2 `R16` texture; it never routes that map through an ordinary browser image decode.
- Entire flattened scene shifts at constrained angles; NOT a true 360-degree model.
- Mouse hover, finger drag, reset, original-image comparison, controlled depth strength, optional drift, and permission-gated phone sensor tilt.
- Graceful image fallback when WebGL or images fail. Motion preferences disable auto drift.
- Page is `noindex,nofollow` until launch approval. No site navigation link yet; deep link only.
- Device/browser QA is required before merge, especially Samsung/Android rendering, motion permissions, and distorted edges.

## Test
Run `cd services/exclusive-engagement && npm test` to include the Living Gallery static regression checks. Run `node scripts/check-sirens-3d-assets.cjs` to validate exact hashes, PNG metadata, more than 8-bit sample diversity, orientation, and strict viewer wiring. For manual smoke tests open each available exhibit, switch original/3D, drag, reset, adjust strength, then test phone tilt on a permission-aware mobile browser.

## Launch gating
After successful owner review only: remove prelaunch noindex, consider adding the gallery to the Relics area, add sitemap entry, then merge in a separate explicitly approved action.
