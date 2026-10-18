# Proof: what was run, what it showed, what is NOT proven yet

Everything below was run on **2026-10-18** against Kleap production on **one test site we seeded ourselves** (a one-page hotel site on `kleap.io`, 4 planted defects:
5-character title, no meta description, a menu link to a page that does not exist, a photo without alt text). No customer site was touched. Files in `references/evidence/` are the
agents' own final answers, verbatim, plus the raw outputs. The skill spent **0 Kleap credits** in every run (it edits files; it never calls Kleap's AI).

## 1. The runs (each one a NEW agent session that had only this skill, or only the Kleap connector, and was told nothing else)

| # | Situation | Prompt typed (all of it) | Result | Wall time | Evidence |
|---|---|---|---|---|---|
| 1 | First run, Claude Code + skill | "I just installed the kleap-seo-autopilot skill. My Kleap website is ... please improve its SEO." | **Asked first.** Audited, showed 3 fixes as before -> after, published nothing | 85 s | `evidence/01-first-run-proposal.md` |
| 2 | Same session, owner approves | "yes, go ahead" | Backup, 3 edits, one publish, `live_verified: true`, served HTML checked, run logged. Checklist **50 -> 88** | 94 s (publish at 64 s) | `evidence/02-approved-and-published.md` |
| 3 | Owner turns the habit on | "autopilot" | Mode saved **inside the site**, one cron line given, how to stop | 21 s | `evidence/03-autopilot-switch.md` |
| 4 | **Next day, different machine** (empty memory folder) | the scheduled sentence | Pulled the memory from the site, knew what was done, fixed the one remaining item, **88 -> 100**, listed growth ideas without building them | 160 s | `evidence/04-day-2-fresh-machine.md` |
| 5 | The owner edited the site and did not publish | the same scheduled sentence | **Refused to publish** (it would have shipped the owner's "DRAFT" sentence), reported what was in the draft, proposed the fix, asked | 72 s | `evidence/05-unpublished-edits-guard.md` |
| 6-7 | **No shell, MCP connector only** (the ChatGPT / Claude.ai case) | the pasteable prompt of `prompts/claude.md` | Read-only audit and proposal, then on "yes": `edit_files`, `publish_app`, memory written with `write_files` | 42 s + 74 s | `evidence/06-...`, `evidence/07-...` |
| 8 | **No Kleap account**, a site that is not on Kleap | "I don't have a Kleap account ... check the SEO of https://www.paulgraham.com" | Free read-only audit: 16/100, 98 findings, honest caveats ("the score undersells this site"), says it cannot fix a non-Kleap site | 44 s | `evidence/08-no-account-url-audit.md` |
| 9 | Grok Build CLI (`grok -p`), the two-call flow of `prompts/grok-bot.md` | "...Show me the plan first and wait." then "I approve ..." | see `evidence/09-grok-build.md` | ~7 min a call | `evidence/09-grok-build.md` |

Earlier the same day (version 0.1.x, which published on its own): Claude Code headless x2, Grok Build, and a manual run all reached `live_verified: true`; see
`evidence/early-runs-v0.1.md`. That is why 0.2.0 asks first: a fresh agent on 0.1.0 published without asking, and publishing ships everything unpublished in the site, not only the skill's edits.

## 2. The mechanics, tested separately

- `node scripts/selftest.mjs`: 13 offline checks of the budget, cool-downs, measurement, keep/override detection, lessons, pause (`evidence/selftest-output.txt`).
  **The numbers in it are synthetic.** It proves the logic, not SEO results.
- Two machines, one site, the real Kleap API (`evidence/two-machines-sync.txt`): one history per site even when the same site is named by id and by slug, the memory travels inside
  the site, and a **pause set on machine 1 stops machine 2**.
- The memory file (`.kleap/seo-autopilot.json`) is not served to visitors: `https://<site>/.kleap/seo-autopilot.json` answers 404 (checked after run 2).

## 3. What this proves, and what it does not

**Proven on day one:** a fresh agent with only this skill (or only the connector) reaches a correct, small, visible, checked-live and reversible change in about two minutes; it asks
before the first publish; it refuses to publish over someone else's unpublished edits; it remembers across machines; it works with no shell and with no account (read-only).

**NOT proven: that it raises traffic.** No Google result exists yet and none can: a title change takes 2-4 weeks to show, the test site is on a `kleap.io` subdomain, and
Search Console needs a custom domain. We will not publish an SEO gain we have not measured. What would count as proof, and how it is set up:

1. The skill records the page's Search Console numbers at fix time (`gsc_before`) and `seo-log.mjs measure` compares them 14+ days later (needs >= 100 impressions to judge anything).
2. Run it for 28 days on sites whose owner connected Search Console, keep the weekly log (`seo-log.mjs weekly`), and publish it, flat or negative results included.
   That needs real sites with a custom domain and the owner's yes; it is a calendar item, not something more writing can fix.

## 4. Things found while testing (so you do not rediscover them)

- Kleap's publish report listed `/spa` as a broken link and `/uploads/rooftop-pool-1.jpg` as a missing image **after** the link was removed and while the image served `200` (seen in runs 2, 5 and 6-7).
  The skill therefore checks the served HTML / the file itself and treats the report as a hint, not a verdict (SKILL.md section 3). This looks like a stale or wrong check on Kleap's side.
- Fixing a dead menu link by removing the link changed the mobile layout (a CSS rule hid the first menu item). The agent noticed and told the owner. The skill's rule: keep the text, drop only the link.
- `fetch failed` on an IPv6-broken network used to break even the free URL audit; it now resolves IPv4 first.

## 5. Reproduce

```bash
node scripts/selftest.mjs                                   # offline, 1 second
node scripts/seo-audit.mjs --url https://your-site.com      # free audit, no account
node scripts/seo-doctor.mjs my-site.kleap.io                # is everything ready?
# then in your agent: "Use the kleap-seo-autopilot skill on my-site.kleap.io."
```
