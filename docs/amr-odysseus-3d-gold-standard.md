# AMR Odysseus Gold Standard 3D — isolated preview
- Branch: `feat/amr-living-gallery-odysseus-gold-standard`; depends on existing Gigantes Living Gallery draft PR #53.
- This exhibit reuses its WebGL shader and controls without duplicating JavaScript.
- Required approved assets (not placeholders):
  - `assets/3d/odysseus/canva-poster.png` — uploaded `Land of the dead(1).png`, 1264×1264.
  - `assets/3d/odysseus/wavespeed-depth.png` — uploaded `Land of the dead_depth(1).png`, 1264×1264.
- **Asset gate:** the approved pair is not yet stored in GitHub; do not merge, deploy, publish gallery card, or call this release-ready before both binaries are added.
- Preserve square image crop, compare original/interactive mode, verify white=near, limit parallax distortion, desktop mouse/phone drag/tilt, reduced motion, WebGL fallback, Lighthouse mobile.
- Prelaunch `noindex,nofollow`; no sitemap, nav, Cinema, or production changes.
- The local preview ZIP provided in the chat contains the exact source binaries for staging upload.
