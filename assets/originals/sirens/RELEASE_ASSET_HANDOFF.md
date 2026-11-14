# AMR Sirens — release asset handoff (DRAFT)

This branch integrates **The Sirens — Ancient Legend Unveiled** into AMR Exclusives and AMR Cinema, but **MUST NOT be merged or deployed until both media files are uploaded and playback is verified**.

## Required self-hosted assets

1. `assets/originals/sirens/film.mp4`
   - Exact approved master in AMR's saved production Library:
     `/AMR/Sirens Production/Sirens_Final_Narrated_QC_V3_CaptionCorrected.mp4`
   - SHA-256: `6c9ccc5f43c36f5e6771f77357f1e8cec2077bfe19f4daa433f07313fc9ede42`
   - Size: 17,646,122 bytes; 540×960 (9:16); H.264 30 fps; AAC stereo 48 kHz; duration 87.166667 seconds.
   - Upload the binary directly with Git/Codex. **Do not transcode, trim, remove the soundtrack, substitute the YouTube copy, or alter captions.**
2. `assets/originals/sirens/poster.webp`
   - Use the official approved Sirens release poster (the artwork used for the published YouTube Short); retain its visual identity.
   - Optimize the original poster to WebP without new artwork or unrelated frames. Verify it on mobile and desktop.

## No-launch gate

- Both assets must be present, reachable through their public paths, and respond with video/mp4 and image/webp MIME types.
- Run `node scripts/verify-sirens-media.mjs`; it must pass before release.
- Verify one-tap unmuted playback on mobile and desktop; captions, Siren voice/song, roar, seeking, controls and fullscreen.
- Confirm the new Share button and comments route /cinema/sirens/.
- Confirm Land of the Dead, Enuk and Laestrygonians playback, shares, Likes/Views on their original dedicated routes, and comments remain intact.
- Verify no horizontal overflow, no extra autoplay, correct poster aspect on phone, and that playback of another film pauses the current film.
- Keep GitHub PR **draft** until owner approves production deployment. No Worker/D1/R2 migration is required for this feature.

A GitHub HTML-only preview will show an unavailable player until the missing media binaries are published. Do not present that preview as QA-passed.
