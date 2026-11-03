# AMR Originals — Living Posters V1

Status: implementation scaffold, **not release-ready**. Feature stays disabled until approved assets are uploaded and tested.

## Release configuration

Add the following object to `data/site-content.json` only when the finished Greek-logo film and approved poster have been uploaded to stable AMR paths:

```json
"featuredOriginal": {
  "enabled": true,
  "title": "The Laestrygonians — Immersive Cinematic Film",
  "description": "Odysseus and his fleet enter a harbor where the giants of legend await.",
  "poster": "assets/posters/APPROVED-LAESTRYGONIANS.webp",
  "videoUrl": "media/APPROVED-LAESTRYGONIANS-GREEK-LOGO.mp4",
  "viewFrames": [
    "assets/posters/APPROVED-LAESTRYGONIANS-LEFT.webp",
    "assets/posters/APPROVED-LAESTRYGONIANS-CENTER.webp",
    "assets/posters/APPROVED-LAESTRYGONIANS-RIGHT.webp"
  ]
}
```

These paths are **examples**, not files confirmed to exist. Do not activate with placeholders. No new film asset or alternate view frames were supplied in this change.

The feature adds a third card only if enabled, poster and video URL are present. Without three or more view frames, the card remains a normal static poster; it does not claim interactivity. Frame movement is a discrete multi-view prototype, not true continuous 3D or interpolated depth. The center frame should match the approved poster, and all frames must be consistent in composition and character identity. The default poster is restored on release. Reduced-motion users receive the static poster.

## Acceptance gates before release

- Obtain and verify the actual Greek-logo film, poster and at least three approved angle views.
- Validate all media URLs, playback, file size and loading on mobile and desktop.
- Verify no ghosting, face changes, scene jumps or misleading 3D claims.
- Test touch gestures, mouse drag, vertical scrolling, reduced motion, and no-JS fallback.
- Confirm homepage opening cinematic remains unchanged; Facebook and YouTube cards are preserved.
- Run project tests, visual QA and Lighthouse; keep video from autoplaying.
- Add GoatCounter interaction and film-start events only after analytics consent/privacy review.
- Do not merge or deploy without owner review.
