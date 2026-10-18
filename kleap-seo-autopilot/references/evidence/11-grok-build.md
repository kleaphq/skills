# Grok Build CLI (grok 1.0.62), the two-call flow of prompts/grok-bot.md

- Day: 2026-10-18 (real clock). Skill version 0.2.1, installed at USER level (`~/.grok/skills`, removed afterwards). Test site 116838 freshly seeded; empty memory folder. Raw transcripts: `harness/runs/it3-grok/call1.txt`, `call2.txt`.
- A first attempt installed the skill in the project folder (`.claude/skills/` next to the work): Grok answered "there is no kleap-seo-autopilot skill on this machine" because `grok inspect` said `Project trusted: no`. Hence the user-level install in `prompts/grok-bot.md`.
- Call 1 prompt: "Use the kleap-seo-autopilot skill on hotel-kleap-prod-check.kleap.io. Show me the plan first and wait." Took **2 min 48 s**; proposed, changed nothing.
- Call 2 prompt: "Use the kleap-seo-autopilot skill on hotel-kleap-prod-check.kleap.io. I approve: apply the top 3 fixes and publish. Then switch hotel-kleap-prod-check.kleap.io to autopilot."
  It backed up, applied the 3 edits, published and checked the live page (**score 50 -> 88**), then **was cut by the 15-minute timeout this harness set (`timeout 900`) while it was about to log the run, save the memory and switch to autopilot**.
  So: Grok Build completes the fix loop but is slow (15+ minutes for this call, against 2 minutes on Claude Code). Schedule it with a generous timeout (30 minutes or more) and few sites per run. The memory of that run was NOT saved, so this row does not show the autopilot switch.

## Call 1, final answer verbatim

I'll follow the Kleap SEO autopilot skill and stop after the plan so you can review it before anything is published.The skill starts with a connection check, then an audit. I'll stop at the plan and wait for your go-ahead before any edit or publish.The checklist is 50/100. I'll read the homepage copy so the three proposed fixes use only facts already on the page.Hotel Kleap Prod Check scores **50/100** on the SEO checklist (4 of 8 checks). Nothing has been edited or published.

These 3 matter most, all on `/` in `src/pages/index.astro`:

1. **Title** (5 characters): `Hotel` → `Hotel Kleap Prod Check — Deluxe Room & Rooftop Pool` (51 characters).
2. **Meta description**: none passed to the layout → `Stay at Hotel Kleap Prod Check: unwind in the Deluxe Room, relax by the Rooftop Pool, and send a stay enquiry to plan your next escape.` (131 characters). The live page currently shows a fallback snippet, `Hotel Kleap Prod Check — A SMALL HOTEL. A LITTLE ESCAPE.`
3. **Menu link** `/spa` (no such page, and the site never describes a spa): the link is removed and the word “Spa” stays, so the menu item is no longer clickable.

Copy uses only what the page already says: Deluxe Room, Rooftop Pool, stay enquiry. Search Console is not connected. On a `*.kleap.io` address it cannot be (`requires_custom_domain: true`), so this run can fix the on-page basics and cannot tell whether Google sends more people. Left for a later run: the hero image `/uploads/rooftop-pool-1.jpg` has no alt text. This is the first run, so there is no snapshot yet. A publish ships every unpublished edit in the site, not only these three.

Apply these 3 and publish? (yes / change something / no)

## Call 2, everything the agent said before the timeout (no final answer was produced)

I'll run the Kleap SEO autopilot on hotel-kleap-prod-check.kleap.io, apply the top three fixes, publish, then turn autopilot on. First I'm reading the skill so I follow its exact steps.The skill starts with a connection check. I'll run that on hotel-kleap-prod-check.kleap.io before any audit or edit.Doctor is ready and this is the first run. Drift is clear, so I'll audit the live site and take its top three fixes. Search Console cannot be connected on a `*.kleap.io` address.The checklist is 50/100. The top three are a missing meta description, a dead `/spa` link, and a 5-character title. You already approved the publish, so I’ll back up the homepage and apply those three edits. Analytics for the last 30 days is 0 visitors. Search Console cannot be connected on a `*.kleap.io` address.The three edits are in the homepage source. Next I’ll publish once and check that the live page matches.The live page matches the three edits: score went from 50 to 88. I’ll log that run, save it on the site, and turn autopilot on.
