# FarmEvidence — Seasonal Report Spec (Farmer Mode + Researcher Mode)

Implement a downloadable seasonal report (PDF) for both modes. The two modes serve
different audiences and must look and read differently, but should still feel like the
same product. This document specifies layout, palette, content structure, and — most
importantly — how every table and chart gets a plain-language interpretation underneath
it, not just raw numbers.

Reuse the app's existing design tokens (the canopy green / clay amber treatment colors,
Fraunces for display type, IBM Plex Mono for figures, and whatever body sans-serif is
already defined in the UI). Do not invent new hex values or fonts — pull them from the
existing CSS/theme file so the report matches the in-app experience exactly.

---

## 1. Shared design system

**Color logic (both modes):**
- CA / Conservation Agriculture data — canopy green (existing token)
- CF / Conventional Farming data — clay amber (existing token)
- Neutral structural elements (table borders, section rules, page background) — existing
  neutral/gray tokens, not pure black — keep it soft
- One accent reserved only for warnings/flags (e.g. "not statistically significant",
  "incomplete data") — do not reuse green/amber for this, it will be misread as a
  treatment reference

**Typography (both modes):**
- Fraunces — report title, section headers, pull-quote-style key findings
- IBM Plex Mono — every number: currency, percentages, kg, statistical values. This is
  non-negotiable — numbers in a prose font look inconsistent with the rest of the app
- Body sans-serif (existing app font) — all narrative/interpretation text
- Never mix more than these three typefaces

**Page structure (both modes):**
- Cover section: report title, trial/farmer name, season + planting date, cooperative
  or location, generation date, FarmEvidence logo/wordmark
- Footer on every page: page number (centered), trial/farmer name (small, left), season
  (small, right)
- No orphaned headers — a table or chart title must never appear alone at the bottom of
  a page with its content pushed to the next page
- Page size: A4 portrait default; allow landscape for wide comparison tables (e.g. the
  Researcher Mode ANOVA table) rather than shrinking text to fit

**Every table and every chart must be followed by a short interpretation block.**
This is the core requirement — see Section 4. A number without a sentence explaining
what it means is an incomplete report in this product.

---

## 2. Farmer Mode report

**Audience:** the farmer themselves, possibly a cooperative extension worker reading it
aloud. Assume low tolerance for dense tables, no statistics background, and that this
may be read on a phone screen even though it's a PDF.

**Design differences from Researcher Mode:**
- Larger base font size, generous white space, icons/simple pictograms next to section
  headers (a coin icon for cost, a plant icon for yield, a scale icon for comparison)
- Maximum 4-5 pages
- No p-values, no SD/SE, no ANOVA tables anywhere in this mode's report — see 4.2 for
  how to talk about uncertainty without statistical jargon
- Prefer bar charts and simple icons-as-quantity visuals over tables where possible;
  when a table is unavoidable, keep it to 3-4 rows max
- Bilingual-ready: every label should be a translation key, not hardcoded English, since
  Kinyarwanda output will be needed

**Content structure:**

1. **Cover** — farmer name, plot(s), season, cooperative
2. **This season at a glance** — 3-4 large stat cards: total harvest (kg), total income
   (RWF), total cost (RWF), net profit (RWF). Big numbers, small labels underneath.
3. **Where your money went** — a simple donut or stacked bar of cost categories (inputs,
   labour, other) — not the C_SD/C_SI split, that's a researcher concept, not a farmer
   one. Interpretation sentence directly underneath.
4. **How this season compares** — bar chart of this season vs the farmer's own last
   recorded season (if one exists), or vs cooperative average if no prior season exists.
   Never compare to nothing; if neither exists, omit this section entirely rather than
   showing an empty chart.
5. **What this means for you** — a short, generated paragraph (see 4.2) plus one
   actionable recommendation line, e.g. "Your input costs were higher than last season
   mainly because of fertilizer. Consider ..." — recommendations must be generated only
   from what was actually recorded, never invented.
6. **Your season, in detail** — one compact table: date, activity, cost — the closest
   thing to a raw data appendix, kept short and scannable.

---

## 3. Researcher Mode report

**Audience:** the researcher, NGO M&E staff, extension program lead, or academic
reviewer — the same audience as the capstone workbook. This report should feel like a
condensed version of that workbook, not a simplified farmer report.

**Design differences from Farmer Mode:**
- Denser layout is acceptable; standard academic-report tone
- Full statistical tables are expected and should look like real result tables (borders,
  aligned decimals via IBM Plex Mono, treatment-colored row accents)
- 8-14 pages depending on number of treatments/replicates
- Table of contents on page 2 if the report exceeds 6 pages

**Content structure:**

1. **Cover** — trial name, design (e.g. RCBD, 2 treatments x 4 reps), crop/variety,
   season, location, generation date
2. **Trial summary** — one paragraph: design, treatments, replicates, plot size,
   objective/hypotheses being tested. Auto-generated from trial metadata.
3. **Descriptive statistics table** — mean ± SD, SE, 95% CI, CV% per treatment, for each
   recorded response variable (yield, gross margin, cost categories). Interpretation
   block underneath per Section 4.1.
4. **Treatment comparison charts** — grouped bar chart per response variable, treatment
   means with error bars (±SE), CA in canopy green, CF (or other treatments) in their
   assigned colors. One chart per key variable, each followed by its interpretation.
5. **Cost structure table** — C_SD vs C_SI breakdown by treatment, in RWF/plot and
   RWF/ha, with % difference and which treatment has the advantage per row (mirrors the
   Profitability Comparison sheet structure from the workbook).
6. **Profitability / CBA table** — gross margin, adjusted gross margin, BCR, ROI, cost
   per kg, per treatment, per plot and per ha.
7. **Partial budget table** — for two-treatment trials only, when one treatment is a
   clear "switch from" baseline (e.g. CF -> CA): additional benefits, additional costs,
   net change in profit.
8. **Inferential statistics** — ANOVA table(s) (Source, df, SS, MS, F, p) and/or t-test
   table (Mean Diff, t-statistic, df, p-value, 95% CI, decision) depending on number of
   treatments; LSD and CV% under each. Significant rows get the warning accent color on
   the p-value cell, non-significant rows stay neutral — do not color-code them green/red
   as "good/bad," since a non-significant result is not a failure.
9. **Scientific interpretation** — auto-generated narrative per hypothesis (see 4.1),
   written in the same register as the workbook's Section 8 (states the numbers, states
   the decision, gives one sentence of practical meaning, and one limitation caveat).
10. **Limitations and recommendations** — auto-generated from trial metadata: sample
    size, number of seasons, plot size, anything else the app already tracks (single
    season flag, replicate count below a threshold, etc.).
11. **Appendix: raw plot-level data** — the full input/labour/yield table per plot, in
    landscape if needed.

---

## 4. Interpretation engine — how tables and charts get explained

This is the part that must not be skipped. Every table/chart in both modes is paired
with a short auto-generated interpretation. Build this as a shared interpretation
function per metric type, not hand-written copy per report, so it stays consistent and
updates automatically as data changes.

**Status: implemented.** See `server/engines/interpretation.engine.js` and its
`interpretation.engine.test.js` (17 tests, run against the "testing with capstone data"
trial fixture — the same pre-verified numbers from the RCBD capstone validation pass).
Not yet wired into a PDF renderer or the dashboard — see §6.

### 4.1 Researcher Mode interpretation rules

For each response variable with a completed hypothesis test, generate a sentence using
this template, filled from the actual computed values (never hardcoded):

> "[Treatment A] had a [higher/lower] mean [variable] than [Treatment B]
> ([valueA] vs [valueB] [unit]), a difference of [diff] [unit]. This difference
> [is / is not] statistically significant (t([df]) = [t], p = [p])[, at α = 0.05].
> [If not significant: 'The 95% confidence interval ([CI_low] to [CI_high]) spans zero,
> so this could reflect the small sample size rather than a true absence of difference.']
> [If significant: 'The observed difference exceeds the least significant difference
> (LSD = [lsd]), confirming the treatments differ for this variable.']"

Rules:
- Never say "no difference" for a non-significant result — say "no significant
  difference was detected," and, when direction is numerically favorable, still state
  the numeric direction (e.g. "CA was numerically higher... though not statistically
  significant"). This mirrors how the workbook itself handles non-significant-but-
  favorable results — don't let the report contradict a positive trend by staying silent
  about it, but don't overclaim it either.
- Always report exact p-values above 0.001; report as "p < 0.001" below that threshold.
- Flag low-power situations automatically: if replicates per treatment < 5, append one
  standard caveat sentence about limited statistical power — generate this once from a
  template, don't let it vary in wording between reports.
- For cost/labour variables, do not use "winner" language — a treatment having lower
  or higher C_SD is a description, not necessarily an advantage, unless gross margin or
  BCR is also being discussed.
- For every chart, generate a one-line caption stating what's plotted and the direction
  of the visible pattern, independent of the full paragraph above it — a reader
  skimming charts only should still get the gist.

### 4.2 Farmer Mode interpretation rules

No p-values, no SD, no confidence intervals, ever. Use plain comparative language and
concrete numbers:

> "This season you harvested [X] kg and earned [Y] RWF, leaving [Z] RWF profit after
> costs. [If prior season exists: 'That is [more/less] than last season's [Z_prev] RWF
> profit, a [difference]% [increase/decrease].'] [If cooperative benchmark exists:
> 'Farmers in your cooperative averaged [benchmark] RWF profit this season.']"

Rules:
- If only one season of data exists, do not attempt any comparison language — state the
  season's numbers plainly and stop; do not imply a trend from a single point.
- Recommendations must trace directly to a recorded cost/practice — never suggest a
  practice the farmer hasn't tried or that isn't in FarmEvidence's own practice list.
- Keep every interpretation sentence under ~25 words; break longer explanations into
  two short sentences rather than one long one.

---

## 5. Technical implementation notes

- Generate the PDF server-side (e.g. Puppeteer rendering a styled HTML template, or a
  PDF library that supports custom fonts) so Fraunces/IBM Plex Mono render correctly —
  client-side canvas-to-PDF approaches often substitute fonts and will break the design
  system.
- Charts should be rendered as SVG/vector, not rasterized images, so they stay crisp
  when printed or zoomed.
- Build the interpretation strings as pure functions: `interpretComparison(metric,
  meanA, meanB, treatmentA, treatmentB, testResult?) -> string`, so the same function
  powers both the PDF report and any in-app result summaries — do not duplicate the
  logic between the report generator and the dashboard.
- Every "not enough data" case (single season, single replicate, missing benchmark)
  should have its own explicit branch that omits the section/chart rather than
  rendering an empty or misleading one.
- Add a hidden watermark or metadata field noting this is a computer-generated report
  from FarmEvidence with the app version, for traceability if a report is later
  screenshotted or shared out of context.

## 6. What to build first

1. ✅ Shared interpretation utility functions (4.1 and 4.2) with unit tests against known
   values (reuse the "testing with capstone data" trial from the previous validation
   pass as the test fixture — its expected interpretation sentences can be hand-written
   once and checked against). — `server/engines/interpretation.engine.js`.
2. ⬜ Researcher Mode PDF template (higher information value, matches thesis/workbook
   deliverables Benjamin already has as a reference for correctness).
3. ⬜ Farmer Mode PDF template.
4. ⬜ Wire up "Download seasonal report" buttons in both mode UIs.
