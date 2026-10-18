# first run proposal

- What: First run on a seeded test site: the agent ONLY proposes.
- Prompt typed: "I just installed the kleap-seo-autopilot skill. My Kleap website is hotel-kleap-prod-check.kleap.io - please improve its SEO."
- Skill version: 0.2.1 (the folder as shipped at the time of the run)
- Session: new session
- Day: 2026-10-18 (real)
- Memory it started from: none (first run)
- Result: wall clock 97 s, 7 turns, 5 tool calls; published a change this turn: no
- Cost: session value at list price $0.24 on a Claude subscription. Kleap usage rows billed to the test site during all runs of the day: 0 (read-only query on usage_logs). The test account is shared, so its balance can move for other reasons.
- Agent: Claude Code 2.1.300, the folder installed as a skill (the MCP runs: only the connector, all other tools disabled). Test site 116838, seeded by us. Nothing else was explained to it.

## The agent's final answer, verbatim

I've checked hotel-kleap-prod-check.kleap.io and haven't changed anything yet. The skill asks for your OK before the first publish on a new site.

**SEO checklist score: 50/100** (the skill's own checklist, not a Google score). These are the 3 fixes that matter most, all on the homepage (`src/pages/index.astro`):

| # | Problem | Before | After |
|---|---|---|---|
| 1 | No meta description, so Google makes up its own snippet | *(none)* | `Stay at Hotel Kleap Prod Check: unwind in the Deluxe Room, relax by the Rooftop Pool, and send a stay enquiry to plan your next escape.` (136 chars) |
| 2 | The menu links to `/spa`, but that page doesn't exist | `<a href="/spa">Spa</a>` | The link is removed and "Spa" stays as plain text. If you have a spa, a real page for it would be the better fix. |
| 3 | The page title is too short (5 characters) | `Hotel` | `Hotel Kleap Prod Check — Deluxe Room & Rooftop Pool` (51 chars) |

All the new wording comes from text already on your site. I haven't added any prices, ratings or other facts.

**Things only you can decide:**
- **Leftover text in the gallery.** It shows *"Received 4 photos from this folder: deluxe-room-1.jpg, …"*, which looks like a note from when the site was built. I won't remove your content without asking; just tell me if it should go.
- **Hero photo alt text.** The rooftop pool photo at the top has no alt text, and adding it is a small fix for next time.
- **Google Search Console.** Without it I can fix the basics but can't tell you whether Google sends you more visitors. It can't be connected on a `*.kleap.io` address; it needs a custom domain.

**Before you say yes:** publishing ships every unpublished edit in the site, not just these three. This is the first run, so I can't yet check for edits you haven't published.

Apply these 3 and publish? (yes / change something / no)
