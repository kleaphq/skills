# first run proposal

- What: First run on a seeded test site. The agent ONLY proposed (nothing changed, nothing published).
- Prompt typed: "I just installed the kleap-seo-autopilot skill. My Kleap website is hotel-kleap-prod-check.kleap.io - please improve its SEO."
- Date: 2026-10-18 (the `TODAY` of the day-2/drift runs was set to 2026-10-19 / 2026-10-20 inside the skill scripts to simulate the next days; the sites and the publishes were real)
- Run: wall_clock_s=85  turns=7  cost_usd=0.23052480000000003  tool_calls=5  first_publish_at_s=None (cost_usd = Claude Code API-equivalent of the session; Kleap credits spent by the skill: 0)
- Agent: Claude Code 2.1.300, a NEW session that had only the skill folder installed (or only the Kleap MCP connector for the MCP runs). Test site 116838, seeded by us. Nothing else was explained to it.

## The agent's final answer, verbatim

Your site is connected and the audit has run. Nothing has been changed yet: on the first run the skill only proposes fixes and waits for your approval before it publishes.

**Your site scores 50/100 on the skill's SEO checklist** (4 of 8 checks pass; this is the skill's own score, not a Google metric). These 3 problems matter most, all on the homepage `/`:

1. **Meta description (missing).** Without one, Google writes its own snippet.
   - Before: *(none)*
   - After: `Stay at Hotel Kleap Prod Check: unwind in the Deluxe Room, relax by the Rooftop Pool, and send a stay enquiry to plan your next escape.` (136 chars)
2. **Broken menu link.** The "Spa" item in the menu links to `/spa`, which doesn't exist. Google sees a broken link and visitors land on a 404.
   - Before: `<a href="/spa">Spa</a>`
   - After: the link is removed and the word "Spa" stays in the menu. If you do have a spa, tell me and I'll propose a Spa page instead. If you don't, you might prefer to take "Spa" out of the menu yourself.
3. **Page title too short.**
   - Before: `Hotel`
   - After: `Hotel Kleap Prod Check — Deluxe Room & Rooftop Pool` (51 chars)

The wording only uses things your site already says. I made up no prices, places or claims.

**Also found, but not in this round (3 fixes per run at most):**
- The large hero image at the top has no alt text.
- A leftover line shows on the live page under the gallery: *"Received 4 photos from this folder: deluxe-room-1.jpg, …"*. You'll probably want to delete it. I won't remove any of your content myself.
- Google Search Console isn't connected, so I can't see what people search for yet. Connecting it needs a custom domain and one click from you.

**Before you approve:** publishing also ships any other unpublished edits in the site. This is the first run, so I can't check whether there are any. If you have edits in progress that you don't want to go live, say so.

**Apply these 3 and publish?** (yes / change something / no) If you say yes, I'll back up the file first, make the 3 edits, publish once, and check the live site. If the check fails, I'll restore the backup and publish again.
