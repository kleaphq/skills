# Reading the numbers: what Search Console says, what the autopilot does

Source: `kleap search-console <site> --period 28d --json` (clicks, impressions, CTR %, average position, top 10 queries, top 10 pages).
Two lists, not page x query: confirm which page ranks for a query by reading that page before you rewrite it.

| What you see | What it means | Autopilot action | Not an autopilot job (tell the owner) |
|---|---|---|---|
| Query with >= 100 impressions, CTR < 2%, position <= 20 | Google shows the page, people do not click the snippet | Rewrite that page's title and description around the query's intent (`gsc_low_ctr`) | |
| Good CTR (> 5%), few impressions | The snippet works, the page is seen too rarely | nothing in metadata | Add real content, an FAQ, internal links from the homepage, a page for the neighboring queries |
| Position 11-20 on a query the page barely mentions | Google is unsure the page answers it | Check title/H1 contain the query's words | Add a section that answers it |
| Position > 20 | Not competitive for that query yet | nothing | Content and links; metadata will not fix this |
| Impressions flat for 4+ weeks, no clicks | Too new or too small | Keep fixing basics (titles, descriptions, alt, links, schema), report "too little data" | Connect Search Console, publish to a custom domain, share the site |
| Clicks up after a title change (same page, 14+ days) | The rewrite worked | Log as `improved`; reuse the pattern (keyword first, benefit, brand last) on pages of the same type | |
| Clicks or CTR down after a title change | The rewrite hurt | Log as `worse`; restore the old title from the log (`before`) | |
| The owner replaced your wording | Your tone was off | Log as `overridden`; use their wording as the style guide for the next page | |

Thresholds used by `seo-log.mjs measure`: a page needs >= 100 impressions on the day of the fix to be judged;
`improved` = CTR +20% relative or average position up by >= 1, with clicks not down more than 20%; `worse` = CTR -20% relative with fewer clicks, or position down by >= 2; otherwise `flat`.
A fix type becomes `doubleDown` after 2 improvements and 0 worse, `dropped` after 2 worse or 2 overrides by the owner.
These are rules of thumb on small numbers: they steer the next run, they do not prove anything. Say so in the report.
