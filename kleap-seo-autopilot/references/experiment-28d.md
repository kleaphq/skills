# 28-day traffic experiment for kleap-seo-autopilot (STARTED 2026-10-19 on the founder's own sites; J3 2026-10-22, J14 2026-11-02, J28 2026-11-16)

Why: every reviewer asks for the same proof: a measured Search Console gain. It cannot be faked and it cannot be rushed (a title change takes 2-4 weeks to show, Search Console lags 2-3 days).
The skill already records `gsc_before` per fix and `seo-log.mjs measure` judges it after 14+ days. What is missing is real sites with Search Console connected. They exist.

## Baseline already captured (read-only, from the 739 daily Search Console rows in `~/.kleap-growth/kle766/gsc.json`, window 2026-09-18 -> 2026-10-15)
Astro sites on the founder's accounts with a custom domain and >= 500 impressions in 28 days (the autopilot only fixes Astro sites; 342, 1849, 11792 are legacy Next.js: excluded).
| app | site | clicks 28d | impressions 28d | avg position | previous 28d clicks / impressions |
|---|---|---|---|---|---|
| 340 | marcoaraujo.ch | 183 | 11,934 | 11.3 | (4 days only) |
| 24347 | serrureriesk.ch | 64 | 10,446 | 19.5 | 63 / 7,594 |
| 41159 | propylon.ch | 87 | 9,088 | 14.3 | 49 / 7,539 |
| 345 | eliottdupuy.com | 49 | 8,459 | 14.0 | 24 / 5,319 |
| 10483 | marjantrajkov.ch | 41 | 6,481 | 11.7 | 32 / 4,596 |
| 331 | juliendelhumeau.com | 111 | 5,013 | 22.0 | (1 day only) |
| 109855 | classement-entreprises.ch | 29 | 4,553 (17 days) | 21.6 | none |
| 366 | blog.petar-photos.com | 22 | 3,947 | 24.3 | 14 / 2,888 |
| 24357 | devisserrurier.ch | 22 | 1,481 | 9.3 | 18 / 1,225 |
| 23866 | homenityvirtual.com | 9 | 580 | 23.5 | 6 / 405 |
Impressions grew between the two windows on almost every site with no autopilot involved (the sites are young): a before/after on one site proves nothing. Hence a control group.

## Design (the only one that survives a skeptical reader)
1. Split the eligible sites into two matched halves by impressions (alternate down the list): TREAT = 340, 41159, 10483, 366, 23866; CONTROL = 24347, 345, 331, 24357, (109855 is too young). The founder may swap sites he does not want touched.
2. TREAT: run the autopilot in `propose` mode for the first run (founder approves the diff once per site), then `auto`. CONTROL: nothing is touched; only the same Search Console numbers are read.
3. At day 14 and day 28: `seo-log.mjs measure` on TREAT; for CONTROL read the same windows. Compare the CHANGE in impressions-weighted position, CTR and clicks between halves, report effect and the width of the noise (CONTROL's own week-to-week swing).
4. Publish the table whatever it says (flat or negative included); under 100 clicks per site in 28 days is "too little data" and stays that way in the write-up.
5. Cost to the founder: one yes per TREAT site, nothing else; no credits (the skill edits files). Risk: it edits live customer-facing sites, so the first run on each site is the propose-and-approve run the skill already enforces.

## Constraints I respected
Nothing was touched: this file is the plan. Several of these sites belong to third parties (osteopath, locksmith, photographer...): the founder decides which are eligible; the skill never loops over an account.

## Design corrections after the panel's review (apply before starting)
- Only 2-3 of the sites clear the skill's own bar (100+ clicks in 28 days: marcoaraujo.ch 183, juliendelhumeau.com 111). The others will read "too little data" on clicks. So the primary metric is impressions-weighted average position and CTR per page and per query, clicks only as a secondary.
- Run the free audit on every candidate first and keep only sites with something worth fixing (impact >= 5): several sites already score 90+ and the fixes would be cosmetic.
- Use the untouched pages of each treated site as an additional control (young sites grow anyway), and pre-register the metric and the day-14 read before the first edit.
- Count the one approved new page per week as part of the treatment, and never auto-rewrite a title on a page that already has 100+ impressions without the owner's yes (a page that ranks is not a metadata problem).
- Start with the founder's own sites (345 eliottdupuy.com, 10483 marjantrajkov.ch): no third-party consent is needed.

## What actually happened on day 0 (2026-10-19)
- Running the skill for real on a complex Astro site exposed four families of false positives in the static source audit (a title/description/h1 set by a wrapper layout, redirect and 404 stubs, links made by React components, word counts of components). On eliottdupuy.com the 0.3.0 audit said 80/100 with a false top 3. 0.3.1 reconciles every finding with the LIVE page: 95/100, and 5 offline checks guard it. Lesson for anyone running this: an audit score from source alone is a hypothesis, the served page is the fact.
- eliottdupuy.com (founder's site) was treated: 3 title trims (62-66 characters to <= 60) on pages with fewer than 12 impressions in 28 days. Honest prior: no measurable movement. marjantrajkov.ch was NOT touched: its owner had 7 unpublished files (two AI edits after the last publish) and a publish would have shipped them. The guard stopped the run, nothing was rebaselined.
- Deviation from the design above: eliottdupuy.com is TREAT here (it was CONTROL); the controls are serrureriesk.ch, juliendelhumeau.com and devisserrurier.ch plus the untouched pages of each treated site.
