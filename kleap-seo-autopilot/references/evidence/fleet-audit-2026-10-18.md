# How much is there to fix? The free audit on 150 random published Kleap sites

- Date: 2026-10-18. Method: 150 sites drawn at random from the Astro sites published on Kleap in the previous 120 days; for each, `node scripts/seo-audit.mjs --url <its public address> --json --max-pages 5`
  (plain GET requests on public pages, 4 sites at a time, nothing written, no login). All 150 answered. Sites are not named here; only the counts are kept. Raw per-site outputs stay with Kleap.
- Limits: 5 pages per site at most (81 of the 150 are one-page sites), the thresholds are this skill's own checklist (title 30-60 chars, description 70-160, one `<h1>`, alt text, working internal links), and "has a finding" is not "ranks badly".

| | Sites (of 150) |
|---|---|
| Score 100/100 (nothing to fix) | **69 (46%)** |
| At least one finding | 81 (54%) |
| At least one finding worth fixing first (impact 5 or more) | **62 (41%)** |
| Median checklist score | 96/100 |

| Finding (on at least one page) | Sites |
|---|---|
| Title under 30 characters (`title_short`) | 39 (26%) |
| Meta description over 160 characters, will be cut (`description_long`) | 23 (15%) |
| A page with under 120 words (`thin_page`) | 22 (15%) |
| Title over 60 characters (`title_long`) | 15 (10%) |
| Menu/body link to a page that answers 404 (`dead_internal_link`) | 13 (9%) |
| Meta description under 70 characters (`description_short`) | 9 (6%) |
| No `<h1>` | 6 (4%) |
| No meta description at all | 3 (2%) |

What this says, plainly: Kleap's builder already ships the basics on most sites, so the fix loop has real work on about 4 sites in 10 and then runs dry. That is why the skill treats a clean site as a win
(it reports the score, then proposes ONE growth idea a week that the owner approves) instead of promising daily fixes.
