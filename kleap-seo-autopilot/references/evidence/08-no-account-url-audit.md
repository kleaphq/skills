# no account url audit

- What: Someone with NO Kleap account asks about a site that is not on Kleap: free read-only audit.
- Prompt typed: "I don't have a Kleap account. I found the kleap-seo-autopilot skill. Can it check the SEO of https://www.paulgraham.com ?"
- Date: 2026-10-18 (the `TODAY` of the day-2/drift runs was set to 2026-10-19 / 2026-10-20 inside the skill scripts to simulate the next days; the sites and the publishes were real)
- Run: wall_clock_s=44  turns=6  cost_usd=0.1680041  tool_calls=4  first_publish_at_s=None (cost_usd = Claude Code API-equivalent of the session; Kleap credits spent by the skill: 0)
- Agent: Claude Code 2.1.300, a NEW session that had only the skill folder installed (or only the Kleap MCP connector for the MCP runs). Test site 116838, seeded by us. Nothing else was explained to it.

## The agent's final answer, verbatim

Yes. The skill has a free audit mode that works on any public site with no account, so I ran it on paulgraham.com. It only sends read-only GET requests.

## Results: 16/100 on the skill's checklist
That score is the skill's own checklist, not a Google metric. It read 12 pages and found 98 issues:

| Issue | Pages affected (of 12) |
|---|---|
| No meta description | 12 |
| No `<h1>` | 12 |
| No viewport tag (not mobile-friendly) | 12 |
| No canonical URL | 12 |
| No `lang` attribute | 12 |
| No structured data (schema) | 12 |
| Images without alt text | 12 |
| Title too short (e.g. just the essay name) | 10 |
| No `sitemap.xml` | site-wide |
| No Open Graph image | 1 |
| Homepage has very little text (about 20 words, navigation is images) | 1 |
| Same title "Paul Graham" on `/` and `/index.html` | 1 |

**Top 3 the skill picked:** add meta descriptions, starting with `/`, `/powerful.html` and `/prepare.html`.

## Caveats
- **The score undersells the site.** paulgraham.com is deliberately hand-built 1990s-style HTML, and it ranks very well anyway because of its content and backlinks. Most of these items matter little for a site like this.
- **One finding is wrong.** `/` and `/index.html` are the same page, so the duplicate title isn't a real problem.
- **Some fixes would actually help:** a viewport tag for mobile, a sitemap, meta descriptions on the popular essays, and alt text on the image-based navigation. The image navigation is the main reason the homepage shows almost no text.
- **The skill can't fix anything here.** Automatic fixing only works for sites hosted on Kleap, and only the owner could make these changes.
