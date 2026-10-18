# Grok Build CLI (grok 1.0.62), the two-call flow of prompts/grok-bot.md

- Date: 2026-10-18. Test site 116838 (the same one the Claude Code runs used, after the MCP-only run had already applied and logged 3 fixes the same day).
- Setup: a new folder with the skill in `.claude/skills/`, `KLEAP_API_KEY` set to a test key, `grok -p ... --always-approve --max-turns 40 --disable-web-search`.
- Call 1 took about 7 minutes, call 2 about 8 minutes (Grok Build is much slower than Claude Code on the same loop: plan for it in a cron timeout).
- Call 1 prompt: "Use the kleap-seo-autopilot skill on hotel-kleap-prod-check.kleap.io. Show me the plan first and wait."
- Call 2 prompt: "Use the kleap-seo-autopilot skill on hotel-kleap-prod-check.kleap.io. I approve: apply the top 3 fixes and publish. Then switch hotel-kleap-prod-check.kleap.io to autopilot."
- What it shows: Grok read the memory that the MCP-only agent had written into the site (a different agent, a different route), recognized the 3 fixes as done and on cool-down, found drift clean, proposed the one remaining fix and waited;
  on call 2 it respected the daily budget (3 fixes were already used that day, so it did not publish again), switched the site to autopilot and gave the schedule line.

## Call 1, final answer verbatim

I'll load the kleap-seo-autopilot skill and run it against hotel-kleap-prod-check.kleap.io in plan-first mode, then stop for your review.The skill starts with a connection check, then a read-only audit. I'll run that and stop at the plan.Hotel Kleap Prod Check scores **88/100** on the SEO checklist (7 of 8 checks). One fix is left. I have not edited or published anything.

1. **`/` hero image, missing alt** (1 of 2 images). The rooftop-pool photo has no `alt`. The label next to it is "01 / ROOFTOP POOL".
   - Before: `<img src="/uploads/rooftop-pool-1.jpg" fetchpriority="high"/>`
   - After: `<img src="/uploads/rooftop-pool-1.jpg" alt="Rooftop pool at Hotel Kleap Prod Check" fetchpriority="high"/>`

Nothing else is in this batch. The title, the meta description, and the `/spa` menu link were already fixed today (3/3), and those pairs stay untouched for 14 days. Drift is clean: the site matches the last published snapshot, so a later publish of this alt would not ship other unpublished edits. Google Search Console is not connected, and connecting it needs a custom domain.

Apply this alt and publish on the next run? (yes / change something / no)
real	7m3.971s
user	0m51.060s
sys	0m48.120s

## Call 2, final answer verbatim

I'll run the Kleap SEO autopilot on hotel-kleap-prod-check.kleap.io: apply the top 3 fixes, publish, then turn autopilot on. First I need the skill's exact workflow.The skill is on disk and the last run already planned one remaining fix. I'll follow that workflow: apply the approved fixes, publish, then switch the site to autopilot.Autopilot is on for **hotel-kleap-prod-check.kleap.io**. The three fixes from earlier today are already live, so this run did not publish again. The daily cap is 3 fixes, and those 3 are already used.

**Checklist: 88/100** (7 of 8 checks). Confirmed on https://hotel-kleap-prod-check.kleap.io:

| Page | Fix | Before | After |
|---|---|---|---|
| `/` | Title | `Hotel` | `Hotel Kleap Prod Check — Deluxe Room & Rooftop Pool` |
| `/` | Meta description | *(none)* | `A small hotel and a little escape: stay in our Deluxe Room, unwind by the Rooftop Pool and send a stay enquiry to plan your visit.` |
| `/` | Menu link to `/spa` | `<a href="/spa">Spa</a>` | `Spa` kept as plain text, no link |

The one open item is the hero photo (`/uploads/rooftop-pool-1.jpg`), which still has no `alt`. That pair was not touched in the last 14 days, and the site matches the last published snapshot. Tomorrow's autopilot run will add `alt="Rooftop pool at Hotel Kleap Prod Check"` and publish once. Google Search Console is not connected. Connecting it needs a custom domain (`kleap search-console connect hotel-kleap-prod-check.kleap.io`).

The mode is saved in the site as `auto`, and the site is listed in `/tmp/fresh-grok/seo-home/sites.txt`. Future runs apply fixes without asking. I have not installed the schedule. To run it every morning at 07:07:

```
7 7 * * * KLEAP_SEO_HOME=/tmp/fresh-grok/seo-home grok -p "Use the kleap-seo-autopilot skill: run its autopilot for the sites in /tmp/fresh-grok/seo-home/sites.txt, then give me the owner report. On Mondays also give the weekly report." --always-approve --max-turns 40 >> /tmp/fresh-grok/seo-home/cron.log 2>&1
```

Files under `/tmp` can disappear when the Mac restarts. Move that folder to `~/.kleap-seo` and update both paths in the line if you want it to survive a reboot. The scheduled run uses your current Kleap login. If the log shows `401`, create a Full key at https://kleap.co/settings/api-key and put `KLEAP_API_KEY=...` at the start of the line.

Say "pause the SEO autopilot" to stop it.

The late file search finished and did not change the result. Autopilot is on for hotel-kleap-prod-check.kleap.io, the three fixes from earlier today are already live, and the hero image alt is the item for tomorrow's run.

real	8m15.920s
user	1m13.479s
sys	1m26.429s
