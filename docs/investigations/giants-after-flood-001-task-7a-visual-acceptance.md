# Investigation 001 — Task 7A Visual Acceptance Report

**Route:** `/mysteries/giants-after-flood-001/`

**Branch:** `feature/giants-after-flood-investigation-001`

**Starting checkpoint:** `772e8c06e16bb81a67c3219001d292e3ec7bb273`

**Audit date:** 2026-10-16

**Disposition:** **STOPPED FOR OWNER REVIEW — local work only**

## Outcome

The approved desktop and mobile hero compositions remain unchanged. One desktop-only readability refinement was applied to the explanatory caption beneath the official poster. No HTML, manuscript prose, artwork, image crop, citation, evidence classification, navigation structure, or metadata was changed.

The previously supplied 390px screenshot with a partially visible headline was captured after scrolling. It is **not a page defect**. At a fresh load with `scrollY = 0`, the full headline is inside the viewport and the approved mobile Flood image follows it in the correct order.

All requested full-page and focused screenshots were generated successfully. The three full-document captures match the rendered document height and are not truncated.

## Exact visual change

**Changed website file:** `mysteries/giants-after-flood-001/giants-after-flood.css`

Desktop official-poster caption only:

| Property | Before | After |
|---|---:|---:|
| Font size | 12.48px | 13.44px |
| Line height | 19.344px | 22.579px |
| Padding | 14.4px 16px | 16.8px 17.6px 18.4px |
| Text color | `rgb(189, 182, 170)` | `rgb(211, 205, 193)` |
| Classification label | Inline with paragraph | Separate line with 0.65rem spacing |

Exact CSS addition:

```css
@media(min-width:901px){.hero .hero-poster figcaption{padding:1.05rem 1.1rem 1.15rem;color:#d3cdc1;font-size:.84rem;line-height:1.68}.hero .hero-poster figcaption .evidence-tag{display:table;margin:0 0 .65rem}}
```

The poster remains uncropped, stays in the approved desktop column, and retains the full classification and historical-evidence distinction.

## Actual defects versus preferences

| Finding | Classification | Action |
|---|---|---|
| Desktop poster caption felt dense | Owner-directed readability preference; not a structural defect | Minimal desktop-only type, spacing, and contrast adjustment applied. |
| Mobile headline partly visible in an earlier screenshot | Screenshot scroll-position issue; **not a site defect** | Verified at scroll zero; no heading change made. |
| Long focused screenshots initially showed a repeated sticky navigation/skip link | Screenshot-stitching artifact; **not a site defect** | Focused exports were regenerated with sticky positioning disabled only inside the screenshot session. Website CSS was not changed for this. |
| Offscreen lazy images initially had zero natural dimensions before scrolling | Test timing artifact; **not broken images** | Final suite eagerly loaded all nine images before integrity checks and screenshots. |

No subjective decorative changes were introduced.

## Mobile initial-load verification

At 390 × 844 after fonts and images settled:

- `scrollY`: 0.
- Headline bounds: top 166.19px, bottom 293.88px, left 16px, right 374px.
- Mobile hero begins at 315.47px, after the headline.
- Hero source loaded at its original 941 × 1672 dimensions.
- Reconstruction classification rendered at 215.52 × 26.48px and remained readable.
- No clipping or horizontal overflow occurred.

## Full-page screenshot completeness

| Viewport | Document height | Screenshot dimensions | Result |
|---|---:|---:|---|
| Desktop 1440px | 19,682px | 1440 × 19,682 | **PASS — complete** |
| Mobile 390px | 25,489px | 390 × 25,489 | **PASS — complete** |
| Narrow mobile 320px | 27,825px | 320 × 27,825 | **PASS — complete** |

No segmented fallback was necessary.

## Visual acceptance review

- **Headline hierarchy:** strong and legible on desktop, 390px, and 320px.
- **Paragraph reading width:** controlled by the existing page shell and narrow-column layouts; no overly wide body-copy blocks were found.
- **Chapter rhythm:** headings, proposition lines, manuscript text, evidence cards, and chapter boundaries remain visually distinct.
- **Artwork:** every approved image is retained. No artwork was generated, replaced, resized on disk, or recomposed.
- **Image framing:** official poster remains uncropped; chapter portraits and archaeological 16:9 cards preserve the approved presentation; the mobile Flood hero remains unchanged.
- **Captions and evidence labels:** readable and consistent; desktop poster caption is improved without changing wording.
- **Archaeological attribution:** Rujm el-Hiri, Shamir, and Golan credits and license links remain visible.
- **Companion Reel:** Chapter III poster and all Reel links remain in place.
- **Door Beyond:** retains cinematic blue/gold impact, Investigation 002 link, speculative classification, evidence boundary, and photo credit.
- **Mobile navigation:** chapter disclosure opens from the keyboard and remains readable.
- **Sources/footer:** source cards, image credits, editorial status, actions, and footer are readable in full-page captures.
- **Consistency:** desktop and mobile retain the same evidence vocabulary, gold/ivory typography, near-black palette, and cinematic tone.

## Regression results

**Final result: PASS — zero failures.**

- All ten required sections present: Prologue, Chapters I–VII, Door Beyond, Sources.
- 26 IDs checked; no duplicates.
- 30 internal anchor targets checked; none missing.
- 43 external URL occurrences are syntactically valid.
- 25 distinct user-facing external URLs checked live: 23 reachable; 2 returned expected access-control responses from the automated client (Taylor & Francis and Sacred Texts), not missing-page responses.
- Companion Reel resolved successfully to the Facebook Reel.
- 12 distinct local references checked; none missing.
- All nine images loaded with nonzero natural dimensions.
- All nondecorative images have meaningful alt text; the decorative Door image remains inside an `aria-hidden` container.
- 31 headings checked: exactly one H1 and no skipped heading levels.
- 17 evidence labels checked; classifications remain present.
- Keyboard focus begins with the functional skip link.
- Mobile chapter disclosure opens with the keyboard.
- Two JSON-LD blocks parse successfully.
- Canonical, Open Graph, and Twitter metadata remain present.
- Local route returned HTTP 200 with no browser, page, or local-asset errors.
- No horizontal overflow at 320px, 390px, or 1440px.
- `index.html`, manuscript content, evidence manifest, image assets, homepage, Giants Map, sitemap, and IndexNow files are unchanged from the starting checkpoint.

The public canonical route was not treated as a deployment test because Task 7A explicitly forbids publishing. No deployment action was performed.

## Screenshot inventory

### Before and after

- `docs/investigations/previews/giants-after-flood-001-task-7a-before-hero-1440.png`
- `docs/investigations/previews/giants-after-flood-001-task-7a-before-poster-caption-1440.png`
- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-after-hero-1440.png`
- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-after-poster-caption-1440.png`

### Full page

- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-full-page-1440.jpg`
- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-full-page-390.jpg`
- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-full-page-320.jpg`

### Focused desktop sections

- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-desktop-prologue.png`
- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-desktop-chapter-1.png`
- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-desktop-chapter-3.png`
- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-desktop-chapter-5.png`
- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-desktop-chapter-6.png`
- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-desktop-chapter-7.png`
- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-desktop-door-beyond.png`
- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-desktop-sources.png`

### Focused mobile sections

- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-mobile-390-initial-load.png`
- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-mobile-390-chapter-5.png`
- `docs/investigations/previews/task-7a/giants-after-flood-001-task-7a-mobile-390-door-beyond.png`

## Files changed

Website code:

- `mysteries/giants-after-flood-001/giants-after-flood.css`

Owner-review deliverables:

- This report.
- Two baseline screenshots.
- Sixteen final screenshots under `docs/investigations/previews/task-7a/`.

## Owner checklist

- [ ] Approve the desktop poster-caption readability refinement.
- [ ] Compare the before/after caption screenshots.
- [ ] Review the 1440px, 390px, and 320px full-page captures.
- [ ] Review focused Chapter V and Door Beyond in both desktop and mobile views.
- [ ] Confirm final acceptance before any push, merge, deployment, sitemap change, or IndexNow submission.

## Commit record

The new local commit hash is reported in the completion response because a commit cannot contain its own final hash.
