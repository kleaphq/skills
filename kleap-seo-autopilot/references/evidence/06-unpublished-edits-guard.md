# unpublished edits guard

- What: Between runs the owner edited the site (a draft sentence and a menu link to a page they have not built) and did NOT publish.
- Prompt typed: "Use the kleap-seo-autopilot skill: run its autopilot for hotel-kleap-prod-check.kleap.io, then give me the owner report."
- Skill version: 0.2.1 (the folder as shipped at the time of the run)
- Session: new session, empty memory folder
- Day: 2026-10-20 (SIMULATED clock)
- Memory it started from: read from the site, written by runs 01-05 (not seeded by hand)
- Result: wall clock 204 s, 8 turns, 6 tool calls; published a change this turn: no
- Cost: session value at list price $0.25 on a Claude subscription. Kleap usage rows billed to the test site during all runs of the day: 0 (read-only query on usage_logs). The test account is shared, so its balance can move for other reasons.
- Agent: Claude Code 2.1.300, the folder installed as a skill (the MCP runs: only the connector, all other tools disabled). Test site 116838, seeded by us. Nothing else was explained to it.

## The agent's final answer, verbatim

# Owner report: Hotel Kleap Prod Check (hotel-kleap-prod-check.kleap.io), 2026-10-18

**I didn't publish anything this run.** Someone changed `src/pages/index.astro` after the autopilot's last publish, and those edits aren't live yet. They look like your work in progress: the hero text now ends with "(owner draft)". Publishing would have sent your draft live along with my fixes, so I only ran the audit and wrote up proposals.

**Score: 75/100 on the skill's own SEO checklist** (not a Google metric). The last run scored 100. The drop comes from two problems that came back after the page was edited:

| Problem | Now | Proposed fix |
|---|---|---|
| Menu link to a page that doesn't exist | "Events" → `/events` | Point it to an existing section, or keep the word "Events" without a link |
| Hero photo has no description for Google and screen readers (alt text) | `/uploads/rooftop-pool-1.jpg` has none | Add `alt="Rooftop Pool at Hotel Kleap Prod Check"` |

The title and meta description are still live as fixed earlier, and the page loads (status 200). The autopilot won't overwrite your own changes for 14 days, so these two fixes wait for your yes.

**What I need from you (pick one):**
1. **Your draft is finished:** say "publish everything as it is". I'll apply the two fixes above and publish once with your edits included.
2. **You already published those edits yourself:** tell me, and I'll mark the current state as the new starting point and continue.
3. **It's still in progress:** do nothing. The autopilot keeps auditing and proposing but won't publish until this is resolved.

**Also worth knowing:**
- **Google Search Console can't be connected** on a `*.kleap.io` address; it needs a custom domain. Until then I can fix the basics but can't tell you whether Google sends you more visitors.
- **Growth ideas, when you're ready.** None are applied without your yes:
  - a separate page each for the Deluxe Room and the Rooftop Pool
  - an FAQ section with questions you confirm
  - an `/llms.txt` file, a short plain-text summary that helps AI search tools describe the hotel correctly

This run is logged in the site's memory file, so any machine running the autopilot sees it. The report is saved at `/tmp/fresh-it3-drift/seo-home/reports/2026-10-18.md`.
