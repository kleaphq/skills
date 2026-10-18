# autopilot switch

- What: The owner says "autopilot": mode saved in the site, schedule line given.
- Prompt typed: "autopilot"
- Date: 2026-10-18 (the `TODAY` of the day-2/drift runs was set to 2026-10-19 / 2026-10-20 inside the skill scripts to simulate the next days; the sites and the publishes were real)
- Run: wall_clock_s=21  turns=3  cost_usd=0.4796648  tool_calls=2  first_publish_at_s=None (cost_usd = Claude Code API-equivalent of the session; Kleap credits spent by the skill: 0)
- Agent: Claude Code 2.1.300, a NEW session that had only the skill folder installed (or only the Kleap MCP connector for the MCP runs). Test site 116838, seeded by us. Nothing else was explained to it.

## The agent's final answer, verbatim

Autopilot is on for **hotel-kleap-prod-check.kleap.io**. Future runs will apply fixes without asking you first. The setting is saved in the site itself, so a scheduled run on any machine will pick it up. I've also added the site to the autopilot's site list at `/tmp/fresh-it2-v020-t1/seo-home/sites.txt`.

**One step left: the daily schedule.** I haven't installed it on your machine. To run it every morning at 07:07, add this line with `crontab -e`:

```
7 7 * * * KLEAP_SEO_HOME=/tmp/fresh-it2-v020-t1/seo-home claude -p "Use the kleap-seo-autopilot skill: run its autopilot for the sites in /tmp/fresh-it2-v020-t1/seo-home/sites.txt, then give me the owner report. On Mondays also give the weekly report and one growth idea." --allowedTools "Bash" --max-turns 60 >> /tmp/fresh-it2-v020-t1/seo-home/cron.log 2>&1
```

- **Move that folder first:** files under `/tmp` can be wiped when your Mac restarts. Moving the folder to `~/.kleap-seo` keeps the site list and backups; then update the two paths in the line to match.
- **Sign-in for the scheduled run:** it should work with your current Kleap login. If the cron log shows a `401` error, create a **Full** key at https://kleap.co/settings/api-key and add `KLEAP_API_KEY=...` at the start of the line.
- **If you'd rather it run with your laptop closed:** it can run as a scheduled cloud agent through Kleap's connector instead. I can set that up with `/schedule`.

**What each run does:** at most 3 fixes and one publish per day. It checks the live page after publishing and undoes anything that fails the check. If you've made your own edits that aren't published yet, it won't publish them; it only reports what it would change. Tomorrow's first item is alt text for the hero image.

To stop it at any time, say "pause the SEO autopilot".
