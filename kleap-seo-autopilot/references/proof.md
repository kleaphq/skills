# Proof: what was run, what it showed, what is NOT proven yet

Everything below was run on **2026-10-18** against Kleap production on **one test site we seeded ourselves** (a one-page hotel site on `kleap.io`, four planted defects: 5-character title, no meta description,
a menu link to a page that does not exist, a photo without alt text). No customer site was touched. `references/evidence/` holds each agent's own final answer **verbatim**, with a header that says what is
real and what is simulated. Read `demo.md` for the first run as a 30-second chat. The skill billed **0 Kleap credits** (the test site has 0 usage rows for the day; the test account is shared, so its balance can
move for other reasons).

## 1. The runs (version 0.2.1; each a Claude Code 2.1.300 session unless it says otherwise)

| # | Situation | Session | Result | Evidence |
|---|---|---|---|---|
| 1 | First run, skill only | new | **Asked first.** Audited, showed 3 fixes as before -> after, published nothing (97 s) | `evidence/01` |
| 2 | Owner says "yes" | resumed from 1 | Backup, 3 edits, one publish, `live_verified: true`, served page fetched, run logged, memory saved in the site. Checklist **50 -> 88** (117 s) | `evidence/02` |
| 3 | Owner says "autopilot" | resumed from 2 | Mode saved in the site; the schedule line was produced by `seo-schedule.mjs` (35 s) | `evidence/03` |
| 4 | **Next day, empty memory folder** | new | Pulled the memory from the site, fixed the last item, **88 -> 100**, listed growth ideas without building them (274 s). *The clock was set to the next day with `KLEAP_SEO_TODAY`; the machine is the same Mac with an empty folder; the site and the publish are real* | `evidence/04` |
| 5 | **Undo from another empty machine** | new | No local backup existed: it reversed exactly its last edit from the memory kept in the site, republished, left the earlier fixes (298 s) | `evidence/05` |
| 6 | The owner left unpublished edits (a draft sentence, a menu link to a page not built yet) | new | **Refused to publish**, named the draft, proposed the fixes, offered 3 ways forward (204 s). *Clock simulated; the memory was written by runs 1-5, not seeded by hand* | `evidence/06` |
| 7 | The owner publishes their draft, then says so | resumed from 6 | Checked the live page, ran `rebaseline`, carried on, asked before touching the owner's two items (87 s) | `evidence/07` |
| 8 | **No shell, no files: Kleap connector only** | new | Read-only audit and proposal in the documented memory format (76 s) | `evidence/08` |
| 9 | Same, approved | resumed from 8 | `edit_files`, `publish_app`, memory written with `write_files`: the shell scripts read it without change (`pull`, `brief`, `weekly` checked) (207 s) | `evidence/09` |
| 10 | **No Kleap account**, a site that is not on Kleap | new | Free read-only audit of `datafa.st`: 80/100, paste-ready title and description for the top fixes, honest caveats (32 s) | `evidence/10` |
| 11 | Grok Build CLI (`grok -p`), the two-call flow of `prompts/grok-bot.md` | new, skill at user level | Call 1 proposed (2 min 48 s). Call 2 applied and published the 3 fixes, **50 -> 88**, then **hit the 15-minute limit we set before it logged the run and saved the memory**: it works, slowly, and needs a generous timeout. Project-level skills were not loaded (`Project trusted: no`) | `evidence/11` |

Earlier the same day (version 0.1.x, which published on its own): Claude Code headless x2, Grok Build and a manual run reached `live_verified: true` (`evidence/early-runs-v0.1.md`). A fresh agent on 0.1.0 published
without asking, which is why 0.2.0 asks first. Versions 0.2.0 -> 0.2.1 fixed what a panel of four reviewers and these runs found (see section 4). After run 5 only `seo-doctor.mjs` (checks run in parallel) and wording changed.

## 2. How much is there to fix? (`evidence/fleet-audit-2026-10-18.md`)

The free audit on **150 random sites published on Kleap in the last 120 days** (read-only, public pages): **46% already score 100/100, 41% have something worth fixing first** (26% a title under 30 characters, 9% a dead link,
4% no `<h1>`, 2% no meta description at all). The fix loop has real work on about 4 sites in 10 and then runs dry, which is why a clean site is reported as a win and followed by ONE approved growth idea a week.

## 3. The mechanics, tested separately

- `node scripts/selftest.mjs`: **37 offline checks, no network, no account** (`evidence/selftest-output.txt`): budget, cool-downs, measurement windows, keep/override detection, lessons, pause; one history per site whatever
  name the agent uses; memory sync between two machines and across the two routes (shell and connector); drift and its two ways out (`published_at` from the API when it exists, `rebaseline`); undo by logged edits that leaves the
  owner's later text; the URL audit against a local fixture site (utility pages ignored, `noindex` pages as notes, `/index.html` = `/`, repeated images counted once, Japanese titles measured by width). **The Search Console numbers in it are
  synthetic**: it tests the logic, not SEO results.
- Two machines, one site, the real Kleap API (`evidence/two-machines-sync.txt`).
- The memory file is not served to visitors: `https://<site>/.kleap/seo-autopilot.json` answers 404.

## 4. What this proves, what it does not, and what was found

**Proven:** a fresh agent with only this skill (or only the connector) reaches a correct, small, visible, checked-live and reversible change in about two minutes; it asks before the first publish; it refuses to publish over someone
else's unpublished edits and has a one-sentence way out; it remembers across machines and across both routes; it undoes only its own text; the free audit works with no account.

**NOT proven: that it raises traffic.** No Google result exists yet and none can: a title change takes 2-4 weeks to show, the test site is on a `kleap.io` subdomain, and Search Console needs a custom domain (the API says so:
`requires_custom_domain: true`). We will not publish an SEO gain we have not measured. What would count as proof, and how it is already set up:
1. The skill records each page's numbers at fix time (`analytics_before` on every fix, `gsc_before` with Search Console); `seo-log.mjs measure` compares windows that start AFTER the fix (28 days, or a 7-day early read), per-day rates, and says
   "too little data" under 100 impressions.
2. A 28-day run on real sites that have a custom domain and Search Console, with an untouched control group, published whatever it says. That needs the owner's yes per site and a calendar: it is a time-bound item, not a writing item.

**Found while testing, fixed in 0.2.1:** the same site named by id and by address kept two histories (now one, and an unknown name stops loudly); a site stayed in "drift" forever after its owner published (now `rebaseline`, and `published_at` when the API gives it);
the connector wrote a different memory format than the scripts read (now one documented format, tested); undo restored a whole old file and could erase the owner's later edits (now it reverses only the logged find/replace pairs); the free audit failed on
IPv6-broken networks, took 98 s on a slow site, ranked `/login` and `noindex` pages in the TOP 3 and counted repeated images twice (now IPv4-first, parallel with a 45 s cap, utility pages ignored, images counted once); cron lines had no PATH and put the key in
the crontab (now `seo-schedule.mjs`).
**Still open and not ours:** Kleap's publish report listed `/spa` as broken after the link was removed, and a photo as missing while it served 200 (seen in all four publishing runs): the skill trusts the served page and says so. `kleap status` does not return `published_at`
(the `publish` response does): asked for in the report.

## 5. Reproduce

```bash
node scripts/selftest.mjs                                   # 37 offline checks, ~10 s
node scripts/seo-audit.mjs --url https://your-site.com      # free audit, no account
node scripts/seo-doctor.mjs my-site.kleap.io                # is everything ready?
# then in your agent: "Use the kleap-seo-autopilot skill on my-site.kleap.io."
```
