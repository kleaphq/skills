# no account url audit

- What: Someone with NO Kleap account asks about a site that is not on Kleap: free read-only audit with paste-ready fixes.
- Prompt typed: "I don't have a Kleap account. I found the kleap-seo-autopilot skill. Can it check the SEO of https://datafa.st ?"
- Skill version: 0.2.1 (the folder as shipped at the time of the run)
- Session: new session, no Kleap key given
- Day: 2026-10-18 (real)
- Memory it started from: none
- Result: wall clock 32 s, 5 turns, 3 tool calls; published a change this turn: no
- Cost: session value at list price $0.17 on a Claude subscription. Kleap usage rows billed to the test site during all runs of the day: 0 (read-only query on usage_logs). The test account is shared, so its balance can move for other reasons.
- Agent: Claude Code 2.1.300, the folder installed as a skill (the MCP runs: only the connector, all other tools disabled). Test site 116838, seeded by us. Nothing else was explained to it.

## The agent's final answer, verbatim

Yes, the skill checked it. Without an account it can only run the read-only audit: 12 pages read, nothing changed on the site.

**datafa.st scores 80/100 on the skill's own checklist (94 of 118 checks pass).** That score comes from the skill itself, not from Google. It found 23 issues, all minor. The site has no missing titles, no missing descriptions and no dead links.

**Top 3 fixes, with text you can paste in:**

1. **/dpa and /tos have the same description**, which is the homepage tagline "Find out which marketing channels drive your revenue". It's also too short.
   - /dpa → `Download the DataFast data processing agreement: add your customer details and get the completed DPA as a PDF.`
   - /tos → `Read the terms and conditions for using DataFast, the web analytics tool that shows which marketing channels drive your revenue.`
2. **/changelog has no `<h1>`.** Add `<h1>DataFast changelog</h1>`.
3. **The /changelog title is short** at 20 characters ("Changelog | DataFast").
   → `DataFast Changelog — New Analytics Features & Updates` (53 characters)

**Smaller issues:**
- **Titles that are too long:** the homepage and several /docs pages (twitter-mentions, twitter-link-attribution, cli-introduction, npm).
- **Descriptions that are too long:** the homepage and /docs/gdpr-cookieless-tracking.
- **No page schema:** the homepage and /mcp have no structured data.
- **Two `<h1>`s on /dpa:** "Data processing agreement" and "DataFast data processing agreement". Keep one of them.

**Probably intentional:** /demo and a /share/... page are set to `noindex`, which makes sense for those pages.

**Growth idea:** the site has no FAQ section with structured data. One built from questions customers really ask could earn rich results in Google.

datafa.st isn't hosted on Kleap, so the skill can't apply these fixes itself. Its automatic edit-and-publish mode only works on Kleap-hosted sites. The fixes above have to be made in the site's own codebase. If you want, I can write the full list with suggested text for every item, including the long titles.
