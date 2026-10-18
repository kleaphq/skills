# The first run, as a chat (read it in 30 seconds)

Real, from `evidence/01` and `evidence/02`, 2026-10-18, a test site we seeded. A new Claude Code session that had only this skill installed. Nothing was explained to it.

**You:** I just installed the kleap-seo-autopilot skill. My Kleap website is hotel-kleap-prod-check.kleap.io - please improve its SEO.

**Agent** (85-97 s later; it audited the site, changed nothing):

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

**You:** yes, go ahead

**Agent** (about 2 minutes later: backup, 3 edits, one publish, live check, run logged, memory saved in the site):

All 3 fixes are live on **https://hotel-kleap-prod-check.kleap.io**, and the SEO checklist score went from **50 to 88**.

| | Before | After |
|---|---|---|
| Homepage title | `Hotel` | `Hotel Kleap Prod Check — Deluxe Room & Rooftop Pool` |
| Meta description | *(none)* | `Stay at Hotel Kleap Prod Check: unwind in the Deluxe Room, relax by the Rooftop Pool, and send a stay enquiry to plan your next escape.` |
| Menu | "Spa" linked to `/spa`, a page that doesn't exist | "Spa" kept as plain text, no link |

I loaded the live page myself: it shows the new title and description, and the `/spa` link is gone. Kleap's publish report still listed `/spa` and a missing rooftop pool photo, but both are out of date. The live page has no `/spa` link, and the photo loads normally.

**One side effect:** on phones the menu used to hide its first link, which was the Spa link. Now that "Spa" is plain text it isn't hidden, so it appears in the mobile menu. Tell me if you'd rather hide it there.

**Still open:**
- **Hero photo alt text.** The rooftop pool photo at the top has no alt text. This is the last item on the checklist and a quick fix next time.
- **Leftover gallery text.** *"Received 4 photos from this folder: …"* still shows in the gallery. It's your content, so I left it; say the word and I'll remove it.
- **Search Console.** It needs a custom domain, so I can't measure Google traffic yet. Your analytics show 0 visitors in the last 30 days, so there's nothing to compare against for now.

**If you want it back:** say "revert" and I'll undo these exact edits and republish. A record of this run is saved inside your site, so a later run on any machine knows what was done.

**Next:** I can add the alt text now. After that, the best growth idea is a separate page each for the Deluxe Room and the Rooftop Pool, written only from facts already on your site, and I'd only build it with your yes. Or say **autopilot** and I'll set this to run every morning.
