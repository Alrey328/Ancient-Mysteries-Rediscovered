# Investigation 001 — Task 7C Door Beyond Integration and QA

**Route:** `/mysteries/giants-after-flood-001/`  
**Branch:** `feature/giants-after-flood-investigation-001`  
**Starting checkpoint:** `ca43450bed23824d5903f84bb3f6386118dc30cc`  
**Integration date:** 2026-10-16  
**Disposition:** **LOCAL COMMIT ONLY — PUBLICATION HOLD**

## Outcome

The exact owner-supplied Door Beyond artwork is integrated as the primary visual in a dedicated responsive image panel. The source was copied byte-for-byte: no regeneration, crop, recolor, filter, recompression, or optimization was applied.

The desktop section uses a two-column image-and-copy composition. At 900px and below, the full portrait artwork stacks above the existing live text. This preserves the complete relationship among the sunrise, circular stone structure, underground opening, turquoise chamber, and ascending figure at every required width.

The approved Investigation 002 title, question, narrative, link, midnight/turquoise/antique-gold palette, and evidence boundary remain intact. Prologue and Chapters I–VII are byte-for-byte unchanged from the starting checkpoint.

## Source and final asset provenance

| Field | Value |
|---|---|
| Classification | **Owner-approved AI-generated cinematic artwork — Door Beyond, Investigation 001** |
| Actual source filename | `Ancient Stone Circle Over a Hidden Titan.png` |
| Accessible source path | `C:\Users\User\Downloads\Ancient Stone Circle Over a Hidden Titan.png` |
| Dimensions | 1024 × 1536 PNG |
| Source SHA-256 | `75db7e695cc70202901ab8f2ddf6092a0f8fbc327040f60b60b0b6df3e5efac2` |
| Final website asset | `mysteries/giants-after-flood-001/investigation-001-door-beyond-approved.png` |
| Final SHA-256 | `75db7e695cc70202901ab8f2ddf6092a0f8fbc327040f60b60b0b6df3e5efac2` |
| Optimization | None. The exact source bytes were retained because the 2.73 MB PNG is already within the size range of existing investigation assets and preserving the approved grading was prioritized. |
| Rights record | Owner approved for AMR website use; generating tool/model not documented. Kept distinct from third-party photographs and unresolved earlier AMR assets. |

## Integration details

- Replaced the licensed Rujm photograph/CSS fallback only within Door Beyond.
- Removed the obsolete future-art slot marker.
- Added intrinsic `width="1024"` and `height="1536"` to prevent layout shift.
- Added lazy loading and asynchronous decoding because the section is far below the initial viewport.
- Added descriptive alternative text identifying the image as a speculative cinematic scene.
- Presented the source at its native 2:3 ratio with `object-fit: contain` and `filter: none`.
- Kept all title and narrative copy as accessible HTML; no text is baked into the image.
- Updated the visible image credit, Sources image-credit list, editorial status, and evidence manifest.
- Restricted styling changes to the Door Beyond component.

## Historical and editorial safeguards

The section still displays:

> **SPECULATIVE ARTISTIC RECONSTRUCTION**

and:

> No evidence establishes an underworld gateway at Rujm el-Hiri.

The public credit additionally describes the artwork as a fictional interpretation rather than documentary or archaeological evidence. The Rujm el-Hiri photograph remains classified as an authentic archaeological photograph for Chapter V only. No archaeological status was assigned to the new artwork.

## Responsive browser QA

Automated Chromium QA loaded the local route over HTTP, waited for fonts and all images, measured the final layout, exercised desktop/mobile Door Beyond navigation, and captured focused screenshots.

| Viewport | Displayed image | Ratio preserved | No overflow | No media/text overlap | Navigation | Result |
|---:|---:|---:|---:|---:|---:|---:|
| 320 × 780 | 286 × 429 | Yes | Yes | Yes | Pass | **PASS** |
| 390 × 844 | 356 × 534 | Yes | Yes | Yes | Pass | **PASS** |
| 768 × 1024 | 678 × 1017 | Yes | Yes | Yes | Pass | **PASS** |
| 1440 × 1200 | 468.7 × 703 | Yes | Yes | Yes | Pass | **PASS** |

At every width:

- The loaded image reports its correct natural dimensions of 1024 × 1536.
- The complete sunrise, stone circle, opening, and figure remain visible.
- The image has no CSS filter and no altered color grading.
- The title remains pale turquoise (`rgb(185, 243, 255)`) and the question remains antique gold (`rgb(255, 240, 202)`) over a midnight foundation (`rgb(3, 9, 12)`).
- Text blocks do not overlap each other or the artwork.
- No horizontal overflow occurs.
- The Investigation 002 link remains `../rephaim/`.
- The mobile chapter disclosure opens and exposes the Door Beyond navigation target.
- All nine page images load with nonzero dimensions.
- No page-script, local-asset, or local HTTP errors occur. Chrome made one harmless initial request for an absent site favicon; it does not affect the page and was not addressed because it is outside Task 7C scope.

## Accessibility and static checks

**Result: PASS.**

- All ten required investigation sections remain present.
- 26 IDs checked; no duplicates.
- All internal anchors resolve.
- All nine images include `alt` attributes; the new image has meaningful narrative alternative text.
- Heading order contains exactly one H1 and no skipped levels.
- Both JSON-LD blocks parse successfully.
- All 17 local references resolve.
- The linked H2, evidence label, disclosure, and credit remain live text.
- Existing keyboard-visible focus and reduced-motion rules remain unchanged.
- Git comparison confirms the hero, Prologue, and Chapters I–VII are unchanged from the starting checkpoint.
- Changed paths are limited to the Door Beyond implementation, its asset/provenance records, this report, and requested screenshots.

## Screenshot inventory

- `docs/investigations/previews/task-7c/giants-after-flood-001-task-7c-door-beyond-1440.png`
- `docs/investigations/previews/task-7c/giants-after-flood-001-task-7c-door-beyond-390.png`
- `docs/investigations/previews/task-7c/giants-after-flood-001-task-7c-door-beyond-320.png`

The 320px capture is the requested narrow-layout check. The 768px layout passed measurement and interaction testing; no additional screenshot was required.

## Exact files changed

Website implementation:

- `mysteries/giants-after-flood-001/index.html`
- `mysteries/giants-after-flood-001/giants-after-flood.css`
- `mysteries/giants-after-flood-001/evidence-source-manifest.json`
- `mysteries/giants-after-flood-001/investigation-001-door-beyond-approved.png`

Owner-review deliverables:

- `docs/investigations/giants-after-flood-001-task-7c-qa.md`
- Three screenshots under `docs/investigations/previews/task-7c/`

No homepage, Giants Map, sitemap, IndexNow, navigation outside Investigation 001, official cover, Flood hero, chapter copy, or other artwork was changed.

## Publication blockers and hold

- Explicit owner authorization is still required before any push, merge, deployment, publication, or indexing request.
- Previously documented commercial-use provenance gaps for the official cover and four earlier AMR reconstructions remain unresolved; Task 7C does not change their status.
- The exact published teaser file `The Ancient Stones of Bashan(2).png` remains missing and was not substituted.
- No new functional or responsive blocker was found for the Door Beyond integration.

## Commit record

The local Task 7C commit hash is reported in the completion response because a commit cannot contain its own final hash.
