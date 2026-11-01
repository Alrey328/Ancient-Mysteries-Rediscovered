# AMR cinematic hero media

This directory is populated by `scripts/prepare-amr-hero-media.ps1` from the approved source files.

- `original/AMR_YouTube_Cinematic_Entrance_V2_Fluid_Unified_Audio(1).mp4` is an unchanged copy of the supplied entrance master.
- `amr-hero-soundtrack.m4a` is a lightweight 48 kHz stereo AAC soundtrack loaded only after a visitor explicitly enables sound. Playback is synchronized to the muted hero video in the homepage script.
- The muted autoplay file and poster are copied to `assets/hero/amr-hero-web.mp4` and `assets/hero/amr-hero-poster.jpg`.

The source files are intentionally not replaced or modified by the preparation process.
