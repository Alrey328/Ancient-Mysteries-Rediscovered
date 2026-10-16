# Investigation 001 — Final Historical Accuracy & Editorial QA

**Investigation:** The Giant Who Escaped the Flood?

**Series:** Giants After the Flood

**Route:** `/mysteries/giants-after-flood-001/`

**Branch:** `feature/giants-after-flood-investigation-001`

**Starting checkpoint:** `39549e8`

**Audit date:** 2026-10-16
**Disposition:** **STOPPED FOR OWNER REVIEW — not pushed, merged, deployed, or published**

## Executive finding

The investigation is historically responsible after one narrow correction in Chapter V. The page consistently separates biblical narrative, later Jewish tradition, archaeological findings, scholarly interpretation, AMR reconstruction, and speculation. No unsupported public factual claim remains in the audited scope.

The one correction narrows a claim about stature from a universal statement about the published archaeological record to the actual finding of the cited Shamir study. Two scholarly links were added to support the already-approved Rujm el-Hiri and Ugaritic discussions. A 320px heading overflow was also corrected without changing the approved design.

The sole high-severity owner issue is rights provenance: the official cover and four AMR reconstructions are byte-for-byte matched to their local source files, but no creator, production-workflow record, standalone license, or commercial-use documentation was found. Each is therefore **OWNER CONFIRMATION REQUIRED** before commercial publication.

## Historical accuracy audit

### Rujm el-Hiri

- **Verified:** the monument has four concentric basalt ring walls, a total diameter greater than 150 m, and a central cairn approximately 20 m across and 5 m high. The date and purpose remain debated. [Birkenfeld et al., PLOS ONE (2026)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0339952)
- **Verified with qualification:** a burial chamber exists in the central cairn. Aveni and Mizrachi argued that the surrounding complex and central cairn belong to different episodes, favoring a later cairn, but that phase relationship is an interpretation rather than an uncontested fact. The manuscript correctly says the burial activity **may** reflect a different phase. [Aveni & Mizrachi, Journal of Field Archaeology (1998)](https://www.tandfonline.com/doi/abs/10.1179/009346998792005261)
- **Verified:** the 2026 reassessment reports more than 30 previously undocumented large circular structures within 25 km and frames Rujm el-Hiri as part of a wider regional building tradition. [Birkenfeld et al. (2026)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0339952)
- **Verified as disputed interpretation:** ceremonial, funerary, and astronomical functions have been proposed; none is settled. The page preserves that uncertainty. A later remote-sensing study challenges fixed astronomical-alignment readings because the landscape has changed. [Khabarova, Birkenfeld & Eppelbaum, Remote Sensing (2024)](https://www.mdpi.com/2072-4292/16/22/4239)
- **Speculation properly labeled:** sunlight, ancestor-memory, and gateway language is explicitly phrased as a question and followed by “The evidence does not establish that this happened at Rujm el-Hiri.” The Door Beyond repeats that no evidence establishes an underworld gateway.

### Shamir Giant Dolmen

- **Verified:** the published monument is approximately 20 m in diameter; its central chamber is about 3 × 2 m with a ceiling around 1.7 m; its capstone is more than 4 × 3.5 × 1.2 m and estimated above 50 tons. The page’s “approximately 50 tons” is conservative. [Sharon et al., PLOS ONE (2017)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0172969)
- **Verified:** fragmentary remains represent at least three people—an adult male, adult female, and young child—within a disturbed multi-burial context.
- **Verified:** the study identifies fourteen clear engraved elements, plus two indeterminate shapes. The manuscript’s “fourteen engraved forms” matches the reported clear forms.
- **Verified:** the authors infer substantial labor, architectural skill, and complex socioeconomic organization. The page does not infer giant builders or giant skeletons from the monument.
- **Qualification applied:** the study does not perform or report a stature analysis. The page now describes that source-specific absence instead of claiming a comprehensive survey of all published archaeology.

### Rephaim, Ugaritic literature, and 1 Enoch

- **Verified:** Deuteronomy presents Og among the remaining Rephaim, while Isaiah 14:9 and Job 26:5 use *rephaim* in poetic settings involving the dead. The page does not force those uses into a single historical population.
- **Verified as scholarly interpretation:** KTU 1.161 places the Ugaritic *rp’um* in a royal funerary/ancestral setting. Suriano discusses the dead king joining royal ancestors and distinguishes recently dead kings from “Rephaim of old”; alternative readings remain in scholarship. [Suriano, Aula Orientalis (2009)](https://www.ub.edu/ipoa/wp-content/uploads/2021/08/20091AuOrSuriano.pdf)
- **Verified and correctly qualified:** the page calls the Ugaritic comparison a scholarly interpretation and says the identity of the *rp’um* and their relationship to biblical traditions remain debated. [Duke, Religions (2025)](https://www.mdpi.com/2077-1444/16/6/726)
- **Verified as a separate tradition:** 1 Enoch 15 describes spirits arising from dead giants. The manuscript explicitly refuses to collapse this into the biblical Og narrative. [1 Enoch 15, R. H. Charles translation](https://original.sacred-texts.com/bib/boe/boe018.htm)

### Biblical and later Jewish sources

- **Verified:** Numbers 21:33–35 and Deuteronomy 3:1–13 narrate Og’s kingship, confrontation, defeat, Rephaim association, and the nine-by-four-cubit object. The page correctly notes that the object’s Hebrew term is commonly rendered “bedstead” but can be interpreted as a sarcophagus.
- **Verified:** the displayed 13.5 × 6 ft values use an explicitly labeled illustrative 18-inch cubit; the page notes that ancient cubit lengths varied and does not equate the object with Og’s height. [Translation commentary on Deuteronomy 3:11](https://tips.translation.bible/story/translation-commentary-on-deuteronomy-311/)
- **Verified:** Genesis 14:5 names Rephaim in a population/geographic setting; Isaiah 14:9 and Job 26:5 use the term in underworld/dead contexts. The page presents these as distinct textual settings.
- **Verified:** *Pirkei de-Rabbi Eliezer* 23 describes Og sitting on wood beneath the ark’s gutter, promising service, and receiving food through an aperture made by Noah. The page correctly identifies this as a later Jewish tradition, not Genesis and not archaeology. [Pirkei de-Rabbi Eliezer 23](https://www.sefaria.org/Pirkei_DeRabbi_Eliezer.23?lang=en)
- **Verified boundary:** Genesis 6:4’s “and also after that” appears only in the owner-supplied cover and is directly qualified in the caption as not conclusive proof of Flood survival. Genesis 7 is the textual baseline used on the page; it does not narrate Og’s survival.

## Claim-by-claim verification matrix

| Chapter | Exact audited passage | Supporting source | Status | Required correction / proposed wording | Reason |
|---|---|---|---|---|---|
| Prologue | “Genesis describes the destruction of life outside the ark; a much later Jewish tradition names Og as an exception.” | [Genesis 7](https://www.biblegateway.com/passage/?search=Genesis%207&version=NRSVUE); [PRE 23](https://www.sefaria.org/Pirkei_DeRabbi_Eliezer.23?lang=en) | **VERIFIED** | None | The page distinguishes the source layers. |
| Chapter I | “Og as king of Bashan, ruling from Ashtaroth and Edrei.” | Numbers 21:33–35; Deuteronomy 3:1–13; Joshua 12:4 | **VERIFIED** | None | The references collectively support kingship, campaign, and royal centers. |
| Chapter I | “Og was among the remaining Rephaim.” | Deuteronomy 3:11 | **VERIFIED** | None | Direct textual association. |
| Chapter I | “nine cubits by four cubits” and “13.5 ft / 6 ft” | Deuteronomy 3:11; [translation commentary](https://tips.translation.bible/story/translation-commentary-on-deuteronomy-311/) | **VERIFIED** | None | Conversion is explicitly illustrative; varied cubits and object/height distinction are disclosed. |
| Chapters II–III | “Og … is said to have survived outside the ark” and the gutter/food scene | [PRE 23](https://www.sefaria.org/Pirkei_DeRabbi_Eliezer.23?lang=en) | **VERIFIED** | None | Accurate summary of the later tradition, not presented as Genesis. |
| Chapter III | “The tradition does not establish that the event historically occurred.” | Source-critical distinction | **VERIFIED** | None | Correct evidence boundary. |
| Chapter IV | “sixty cities in the region of Argob” and fortified towns | Deuteronomy 3:4–5 | **VERIFIED** | None | Directly supported by the cited passage. |
| Chapter IV | Rephaim can denote ancient inhabitants and also occur in poetry about the dead | Genesis 14:5; Isaiah 14:9; Job 26:5 | **VERIFIED** | None | Different textual contexts are preserved rather than conflated. |
| Chapter V | Rujm el-Hiri is “more than 150 meters across” with a central cairn and burial chamber | [Birkenfeld et al. 2026](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0339952); [Aveni & Mizrachi 1998](https://www.tandfonline.com/doi/abs/10.1179/009346998792005261) | **VERIFIED** | None | Monument form and chamber are supported. |
| Chapter V | “The central burial activity may reflect a different phase” | [Aveni & Mizrachi 1998](https://www.tandfonline.com/doi/abs/10.1179/009346998792005261) | **VERIFIED** | None | “May” preserves the disputed chronology. |
| Chapter V | 2026 work identified a wider regional tradition | [Birkenfeld et al. 2026](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0339952) | **VERIFIED** | None | The article reports more than 30 additional examples within 25 km. |
| Chapter V | Shamir capstone, multiple burials, adults/child, and fourteen engravings | [Sharon et al. 2017](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0172969) | **VERIFIED** | None | Matches the article’s measurements, osteological minimum, and clear engraved forms. |
| Chapter V | “There is no published archaeological demonstration that the people buried there were exceptionally tall.” | [Sharon et al. 2017](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0172969) | **QUALIFICATION REQUIRED** | Applied: “The published study does not report evidence of exceptional stature among the people buried there.” | The paper does not report stature evidence, but it is not a systematic review of all regional publications. |
| Chapter V | Sunlight may symbolize contact with ancestral memory | Rujm scholarship does not establish this symbolic reading | **SPECULATIVE — CLEARLY LABELED** | None | Presented as a question and expressly disclaimed. |
| Chapter VI | Isaiah 14’s Rephaim are departed rulers/shades | Isaiah 14:9 | **VERIFIED** | None | Poetic underworld setting is explicit. |
| Chapter VI | Ugaritic *rp’um* may involve deceased or exalted ancestral figures | [Suriano 2009](https://www.ub.edu/ipoa/wp-content/uploads/2021/08/20091AuOrSuriano.pdf); [Duke 2025](https://www.mdpi.com/2077-1444/16/6/726) | **VERIFIED** | None | Page labels this a debated scholarly interpretation. |
| Chapter VI | 1 Enoch 15 preserves a separate dead-giant spirit tradition | [1 Enoch 15](https://original.sacred-texts.com/bib/boe/boe018.htm) | **VERIFIED** | None | The manuscript explicitly keeps it separate from Og and biblical Rephaim contexts. |
| Chapter VII | Archaeology does not establish that Og built the monuments or giants inhabited them | Cited Rujm and Shamir studies | **VERIFIED** | None | Neither study connects the sites with Og or giants. |
| Door Beyond | An underworld gateway at Rujm el-Hiri | No archaeological source establishes it | **SPECULATIVE — CLEARLY LABELED** | None | The question is paired with an explicit no-evidence boundary and speculative-art label. |
| Cover caption | Genesis 6:4, “and also after that,” is not conclusive proof of survival | Genesis 6:4; Genesis 7 | **VERIFIED** | None | The page directly limits the embedded cover quotation. |

**Unsupported findings:** none remain in public copy after the documented Shamir qualification.

## Exact editorial and implementation diff

### Manuscript correction — Chapter V

```diff
- There is no published archaeological demonstration that the people buried there were exceptionally tall.
+ The published study does not report evidence of exceptional stature among the people buried there.
```

Reason: narrows the sentence to what Sharon et al. (2017) actually reports without changing the narrative’s meaning or voice.

### Source additions — no narrative rewrite

```diff
+ Aveni & Mizrachi (1998), Rujm el-Hiri geometry, excavation context, and proposed phases
+ Suriano (2009), KTU 1.161 and Ugaritic royal ancestors
```

### Provenance record

The evidence manifest now records audit date, creator/workflow/license/commercial-use status, and **OWNER CONFIRMATION REQUIRED** for each AMR artwork. The obsolete “manuscript missing” entry was removed; missing Door assets and rights documents remain recorded.

### Responsive regression correction

```diff
+ @media(max-width:350px){h2{font-size:2.15rem}}
```

Reason: long Cinzel headings produced a 330px document width in a 320px viewport. The scoped rule removes overflow without changing desktop, 390px, or the approved layout structure.

## AMR artwork provenance and rights register

All five repository files are exact SHA-256 matches to the listed owner-supplied source files. File presence and checksum identity establish provenance of the bytes, **not commercial rights**. No embedded EXIF/XMP/ICC creator or generating-tool metadata and no standalone license document was found.

| Website asset / use | Exact source file | SHA-256 | Known creator / workflow | License or usage document | Commercial use supported? | Status |
|---|---|---|---|---|---|---|
| `investigation-001-official-cover.png` — cover/social | `C:\Users\User\Downloads\Giants After the Flood Investigation.png` | `db65b78de0799a0bd42deb8aac13336e248c1e63f2450dbb10cd9b49ddf20202` | Creator not documented; owner-supplied AMR production asset | Owner approval for this investigation; no standalone rights record | Not established by available records | **OWNER CONFIRMATION REQUIRED** |
| `investigation-001-hero.png` — companion Reel | `C:\Users\User\Downloads\The Giant Who Survived Noah’s Flood Chap 1 Poster.png` | `ef86bda57d895a80ee27c0503da14c4589e93096ec14744d0ba2ee4b0c906133` | Creator not documented; owner-supplied AMR production asset | No standalone rights record | Not established | **OWNER CONFIRMATION REQUIRED** |
| `investigation-001-og-bashan.png` — Chapter I | `C:\Users\User\Downloads\Asset 3 Og of Bashan_ Giant King at the Fortress.png` | `a9bc86876c59d56c06c999fd91d0cc21fb97cceae3b1ba7e52bfc5a5f08b8864` | Creator not documented; owner-supplied AMR production asset | No standalone rights record | Not established | **OWNER CONFIRMATION REQUIRED** |
| `investigation-001-flood-tradition.png` — mobile hero | `C:\Users\User\Downloads\IMg 2 GAF Giant Clinging to the Ark in the Storm.png` | `ee58394c5fd5f56d524f96a9fa1f13a69f71498ecd360b44d45e1a911dee1ff9` | Creator not documented; owner-supplied AMR production asset | No standalone rights record | Not established | **OWNER CONFIRMATION REQUIRED** |
| `investigation-001-rephaim-underworld.jpg` — Chapter VI | `C:\Users\User\Downloads\Underground world Rephaim.jpg` | `b91ce7219109a66979191b52f038389366e7961bed53b78fa2d54cfad5bef62d` | Creator not documented; owner-supplied AMR production asset | No standalone rights record | Not established | **OWNER CONFIRMATION REQUIRED** |

### Documentary photographs retained unchanged

| Photograph | Source record | License condition | Audit result |
|---|---|---|---|
| Rujm el-Hiri, Bukvoed | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Rujm-el-Hiri-729.jpg) | CC BY 4.0; attribution and change notice | Attribution/link retained. File unmodified; Door Beyond color is a separate CSS overlay. |
| Giant Dolmen–Shamir, שועל | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Giant_Dolmen-Shamir.jpg) | CC BY-SA 4.0; attribution, and share-alike if adapted | Attribution/link retained; file unmodified. |
| Northern Golan Heights, Shlomo Roded / PikiWiki Israel | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:130476_views_of_the_northern_golan_heights_on_the_syrian_PikiWiki_Israel.jpg) | CC BY 2.5; attribution | Attribution/link retained; file unmodified. |

## Remaining unresolved findings, ranked

1. **HIGH — AMR artwork rights provenance.** Commercial-use authority for the official cover and four reconstructions is not established by the scoped records. Owner must identify the creator/workflow and confirm that source material, model/tool terms, fonts, marks, and any third-party components permit the intended public/commercial use.
2. **MEDIUM — Dedicated Door Beyond artwork is absent.** The approved final artwork was not found. The existing licensed Rujm photograph plus clearly labeled CSS treatment remains a compliant fallback; do not substitute other art without approval.
3. **MEDIUM — Exact teaser asset absent.** `The Ancient Stones of Bashan(2).png` was not found. It remains recorded as missing and was not substituted.
4. **LOW — Rujm chronology/function remain scholarly questions.** The page appropriately uses “may,” “proposed,” and “remain debated.” Future copy changes must retain this qualification.
5. **LOW — Ugaritic/biblical Rephaim relationship remains disputed.** The current copy calls it interpretation and does not conflate traditions.

## Technical regression results

**Result: PASS.** Local browser validation completed with no failures after the 320px heading correction.

- All ten required sections present: Prologue, Chapters I–VII, Door Beyond, Sources.
- Approved manuscript matches in Prologue and Chapters I–VII, except the one exact documented Chapter V correction.
- Internal checklist/placeholder text absent from public HTML.
- 26 IDs checked; no duplicates.
- 30 internal anchors checked; no missing targets.
- 12 distinct local references checked; no missing local files.
- 43 external URLs parsed successfully; key historical sources were opened and audited separately.
- Two JSON-LD blocks parse successfully.
- Canonical, Open Graph, and Twitter metadata preserved.
- Official cover preserved and SHA-256 verified.
- Companion Reel preserved at `https://www.facebook.com/share/r/1EtfycqkWy/` in three links.
- Door Beyond links to Investigation 002, contains no “COMING SOON/NEXT,” and retains its speculation boundary.
- 320px, 390px, and 1440px layouts have no horizontal overflow.
- Local preview returned HTTP 200 with no browser, page, or asset-response errors.
- Root homepage, Giants Map, sitemap, and IndexNow files were not modified.

## Updated screenshots

- `docs/investigations/previews/giants-after-flood-001-1440-task-6.png`
- `docs/investigations/previews/giants-after-flood-001-1440-chapter-5-task-6.png`
- `docs/investigations/previews/giants-after-flood-001-390-task-6.png`
- `docs/investigations/previews/giants-after-flood-001-390-chapter-5-task-6.png`
- `docs/investigations/previews/giants-after-flood-001-320-task-6.png`
- `docs/investigations/previews/giants-after-flood-001-320-chapter-5-task-6.png`

## Final owner-approval checklist

- [ ] Approve the single Chapter V stature qualification.
- [ ] Approve Aveni & Mizrachi (1998) and Suriano (2009) as added scholarly references.
- [ ] Confirm creator and production workflow for all five AMR artworks.
- [ ] Confirm commercial-use authority and any third-party/model/tool restrictions for all five AMR artworks.
- [ ] Approve continued use of the licensed Rujm photograph/CSS fallback until dedicated Door Beyond artwork is supplied.
- [ ] Decide whether to supply `The Ancient Stones of Bashan(2).png`; no substitute has been used.
- [ ] Review desktop 1440px and mobile 390px/320px screenshots.
- [ ] Approve the ≤350px heading-size regression fix.
- [ ] Give separate explicit authorization before any push, merge, deployment, publication, sitemap change, or IndexNow submission.

## Commit record

The new local commit hash is reported in the Task 6 completion response because a commit cannot contain its own final hash. No remote action is authorized or performed.
