# Reel Release Pipeline V2

## Goal

Turn Reel publication into a preload -> hold -> release -> verify workflow. Release-specific metadata belongs in `data/video-releases.json`; the Python release controller should not require a code edit for each poster or legacy URL.

## Release record

Each release may define:

- `title`
- `state`: `off` or `on`
- `videoUrl`
- `poster`
- `investigationPath`
- `legacyVideoUrl`

Example:

```json
"giant-of-kandahar-2": {
  "title": "The Kandahar Giant: The Story Didn't End There",
  "state": "off",
  "videoUrl": "https://www.facebook.com/share/r/.../",
  "poster": "kandahar-giant-2-poster.png",
  "investigationPath": "mysteries/giant-of-kandahar/",
  "legacyVideoUrl": "https://www.facebook.com/share/r/.../"
}
```

## Operating procedure

1. Approve the final Reel and exact poster.
2. Upload the poster to the repository before release day.
3. Preload the release record with `state: off`, the Reel URL, poster filename, canonical Investigation path, and legacy Reel URL when applicable.
4. Leave the website in HOLD until Facebook publishes.
5. Run Video Release Control with state `on`.
6. The controller validates the poster and Investigation path, promotes the new Reel, updates the primary Watch the Story link, and preserves the legacy Reel.
7. Verification must confirm the release record is ON, the expected poster is referenced, the new video URL is primary, the Investigation CTA remains canonical, and the legacy URL remains present when configured.

## Safety rules

- Never regenerate or substitute an approved poster during release.
- Never turn a release ON if its configured poster file is missing.
- Never replace the canonical Investigation URL for a 2.0 Reel.
- Never discard the original Reel when `legacyVideoUrl` is configured.
- Release failure should stop the workflow rather than publish a partial state.
