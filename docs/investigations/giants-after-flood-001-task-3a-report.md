# Investigation 001 — Task 3A Mobile Hero Refinement

## Status

Local review implementation complete on `feature/giants-after-flood-investigation-001`. No push, merge, deployment, production-route change, sitemap update, IndexNow submission, homepage edit, or Giants Map edit was performed.

## What changed

1. Added a mobile-only cinematic hero scene immediately after the investigation title.
2. Reused `investigation-001-flood-tradition.png`, an existing approved AMR reconstruction already staged for Chapter III. The 941 × 1672 source contains no embedded poster lettering and shows the established giant gripping the ark amid floodwaters. The source file was not edited; CSS supplies a responsive viewport and focal position.
3. Kept the approved poster, disclosure, two-column composition, premise, and both calls to action unchanged on desktop.
4. Set the mobile title to three controlled lines: `THE GIANT` / `WHO ESCAPED` / `THE FLOOD?`, with a smaller fluid size and tighter vertical rhythm.
5. Moved the mobile premise below the cinematic image, followed immediately by `ENTER THE INVESTIGATION`; the companion Reel button remains directly beneath it.
6. Replaced the cramped mobile Roman-numeral row with a native `<details>` / `<summary>` control labeled `EXPLORE CHAPTERS`. Its ten links reach Prologue, Chapters I–VII, Door Beyond, and Sources. Desktop navigation is unchanged.
7. Added safe-area-aware mobile navigation padding, visible keyboard focus styles, touch-friendly controls, and no new motion.

## Before / after

- Before: the 390px opening placed navigation, a tall four-line title, premise, and both buttons before the poster. The giant was below the initial viewport.
- After: a compact chapter control and three-line title lead directly to the text-free Flood scene. The giant's face, grip, floodwater, and ark are visible within the first 390px mobile viewport; the premise and buttons follow the image.
- Comparison: `docs/investigations/previews/giants-after-flood-001-mobile-before-after-task-3a.png`

## Screenshots

- 390px mobile hero: `docs/investigations/previews/giants-after-flood-001-mobile-390-task-3a.png`
- 320px mobile hero: `docs/investigations/previews/giants-after-flood-001-mobile-320-task-3a.png`
- 1440px desktop preservation: `docs/investigations/previews/giants-after-flood-001-desktop-1440-task-3a.png`
- Full-page 390px mobile with the chapter navigator expanded: `docs/investigations/previews/giants-after-flood-001-mobile-full-task-3a.png`
- Original Task 3 mobile baseline: `docs/investigations/previews/giants-after-flood-001-mobile.png`

## Asset selection and provenance

| Asset | Use | Classification | Treatment |
| --- | --- | --- | --- |
| `investigation-001-flood-tradition.png` | Mobile hero and existing Chapter III figure | Existing approved AMR cinematic reconstruction; not archaeological evidence | Original file reused without modification; mobile crop is CSS-only. Internal production-rights record still requires confirmation before publication. |
| `investigation-001-hero.png` | Desktop hero | Existing approved AMR poster/reconstruction | Unchanged. |

No image was generated, replaced, renamed, moved, or stretched. The mobile caption continues to identify the scene as an AMR cinematic reconstruction derived from later tradition.

## Validation

| Check | Result |
| --- | --- |
| Required investigation sections | Pass — 10/10 present |
| Mobile chapter destinations | Pass — 10/10 anchors present |
| Local references | Pass — 16 checked, 0 broken |
| Duplicate IDs | Pass — none |
| Structured data | Pass — 2/2 JSON-LD blocks parse |
| 390px layout | Pass — viewport/body width 390; no overflow |
| 375px layout | Pass — viewport/body width 375; no overflow |
| 480px layout | Pass — viewport/body width 480; no overflow |
| 320px layout | Pass — complete title and controls visible; no overflowing child elements and horizontal scrolling remains locked at `scrollX = 0` (Edge headless exposes a 330px minimum layout canvas) |
| Mobile image timing | Pass — meaningful giant/action crop appears within the first viewport at 320px and 390px |
| Desktop 1440px | Pass — visual comparison shows the approved hero composition unchanged; no overflowing elements |
| Keyboard/screen-reader navigation | Pass — native `details`/`summary`, descriptive label, normal anchor links, and visible `:focus-visible` states |
| Reduced motion | Pass — existing reduced-motion protections preserved |
| Homepage, Giants Map, sitemap, IndexNow, Door Beyond | Pass — no changes |

## Preserved editorial protections

All seven manuscript placeholders, source references, archaeology credits, licenses, evidence categories, reconstruction disclosures, and the Door Beyond treatment remain unchanged.

## Stop condition

This refinement is ready for local owner review only. It has not been published.
