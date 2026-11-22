# Kandahar artwork registry

Numbered identifiers prevent confusing the three different Kandahar posters. Existing asset filenames are retained to avoid breaking page references.

| Identifier | Exact repository asset | Assigned use |
| --- | --- | --- |
| **Poster 1 — CURRENT FEATURED REEL** | `assets/posters/AMR_Giant_of_Kandahar_Original_Reel_Poster.png` | Homepage Featured Premiere: “THE GIANT OF KANDAHAR — WAS THERE MORE THAN ONE?” |
| **Poster 2 — PREVIOUS REEL** | `kandahar-giant-2-poster.png` | Earlier Kandahar Reel archive card |
| **Poster 3 — INVESTIGATION** | `mysteries/giant-of-kandahar/giant-of-kandahar-poster.png` | Giant of Kandahar investigation page |

## Other Kandahar images (not numbered posters)

- `mysteries/giant-of-kandahar/giant-of-kandahar-reel-image.png`
- `mysteries/giant-of-kandahar/giant-of-kandahar-rock-background.jpg`
- `mysteries/giant-of-kandahar/kandahar-caption-material.jpg`

## Editorial rules

- Never replace Poster 1 with Poster 2 or Poster 3.
- Homepage `data/site-content.json > featuredReel.poster` must reference Poster 1.
- Do not rename or delete existing artwork without auditing all page references.
