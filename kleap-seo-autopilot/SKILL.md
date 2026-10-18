---
name: kleap-seo-autopilot
description: >-
  Free SEO audit of any website, no account. On a Kleap site your agent also fixes the top 3 problems, publishes them, checks
  the page is live and tells you what changed: titles, meta descriptions, image alt text, dead links, schema, Google queries
  seen but not clicked. It asks before the first publish, refuses to ship your unfinished edits, remembers inside your site and
  learns from the results. Use when the user says "improve my SEO", "SEO autopilot", "audit my site", "why am I not on Google",
  or schedules a recurring agent task on a site built with Kleap.
version: 0.2.1
license: MIT
compatibility: "Claude Code, OpenClaw, Hermes Agent, Codex, Grok Build and any Agent Skills client with a shell and Node >= 18. Agents without a shell (ChatGPT, Claude.ai, Grok API) run the same loop through the Kleap MCP connector: see prompts/."
metadata:
  openclaw:
    emoji: "🔎"
    homepage: "https://kleap.co/mcp"
    primaryEnv: KLEAP_API_KEY
    requires:
      bins:
        - node
        - npx
    envVars:
      - name: KLEAP_API_KEY
        required: false
        description: "kleap_live_sk_... key (Full preset), only for unattended runs. Interactive use signs in with `npx -y kleap-cli@2.1.0 auth login` and needs no key. The free URL audit needs neither."
---

# Kleap SEO autopilot

**Free SEO audit of any website in seconds, no account.** On a site hosted on Kleap, your agent also fixes the **3 biggest problems**, publishes them, proves the page is live, and tells you exactly what changed.
It asks before the first publish, remembers what it did inside your site, checks later whether it helped, and gets better at your site. Edits are direct file edits: no Kleap AI, no credits spent by the skill.

| Level | What | Needs |
|---|---|---|
| **0 Audit** | Checklist score + top fixes for **any public website** | Node only. No account, no key |
| **1 Fix** | Fixes the top 3, publishes, verifies it is live, undoes failures, reports | A site on Kleap + `npx -y kleap-cli@2.1.0 auth login` |
| **2 Grow** | Once the basics pass: one proposal a week (new page, FAQ, answer to a Google query), only with the owner's yes | Level 1 |

**Real runs** (a test site we seeded, 2026-10-18; a new Claude Code session that had only this skill, or only the Kleap connector; skill credits billed: 0). Transcripts and honest labels: `references/proof.md`.

| Run | What happened |
|---|---|
| 1. First run (97 s) | Audited, showed 3 fixes as before -> after, **asked**, published nothing |
| 2. Owner says "yes" (117 s) | Backup, edits, one publish, `live_verified: true`, served page checked. Checklist **50 -> 88** |
| 3. Next day on an empty machine (clock set to the next day, 274 s) | Pulled its memory from the site, fixed the last item, **88 -> 100**, proposed growth ideas without building them |
| 4. Revert from yet another empty machine | Undid exactly its last edit from the memory in the site (no local backup), republished, left the earlier fixes |
| 5. Owner left unpublished edits | **Refused to publish** them, named them, offered 3 ways forward; after the owner published, one sentence re-baselined it |
| 6. Connector only (no shell, no files) | Same loop through MCP tools; the memory it wrote is read by the scripts |

| Page | Problem | Before | After |
|---|---|---|---|
| `/` | title too short | `Hotel` | `Hotel Kleap Prod Check — Deluxe Room & Rooftop Pool` |
| `/` | no meta description | *(none: Google invents a snippet)* | `Stay at Hotel Kleap Prod Check: unwind in the Deluxe Room, relax by the Rooftop Pool, and send a stay enquiry to plan your next escape.` |
| `/` | menu link to a page that does not exist | `/spa` | link removed, text kept, owner told |

**How much is there to fix?** The free audit on 150 random sites published on Kleap: 46% already score 100/100, 41% have something worth fixing first (26% a title under 30 characters, 9% a dead link, 4% no `<h1>`, 2% no meta description). So the fix loop has real work on about 4 sites in 10, then runs dry: that is why a clean site is reported as a win and followed by ONE approved growth idea a week, not by daily "fixes".
**Not proven yet: traffic.** Google needs weeks and the first long-run results are not in. Day one proves that every change is small, visible, checked live and reversible; `references/proof.md` says what would count as proof and how this skill collects it. `node scripts/selftest.mjs` runs 37 offline checks. Risks and undo: `skill-card.md`.

**Try it now:** `node scripts/seo-audit.mjs --url https://your-site.com` (any public site, read-only, 3-10 seconds on a normal site; with nothing installed: `curl -fsSL https://raw.githubusercontent.com/kleaphq/skills/main/kleap-seo-autopilot/scripts/seo-audit.mjs | node - --url https://your-site.com`, one file of plain GET requests: read it first), or tell your agent: *"Use the kleap-seo-autopilot skill on my-site.kleap.io."*
Not sure it is ready on this machine? `node scripts/seo-doctor.mjs my-site.kleap.io` prints a checklist and the one next step.

`SKILL_DIR` = the folder holding this file (scripts, `references/memory-format.md`, `skill-card.md`). `SEO_HOME` = `${KLEAP_SEO_HOME:-$HOME/.kleap-seo}` (a local cache of the memory). `K` = `npx -y kleap-cli@2.1.0`
(pinned on purpose; or `kleap` after `npm i -g kleap-cli`, then `export KLEAP_BIN=kleap`). Every `$K` command takes `--json`; exit 0 = ok.

## Hard rules (read first)

1. **Connect before anything.** Run `node $SKILL_DIR/scripts/seo-doctor.mjs [site]`. If it prints a `NEXT:` line, do that and stop. Never ask the owner to paste a key into the chat.
2. **The first run on a site proposes; it does not publish.** Show the fixes as before -> after, ask once, apply on "yes". Skip the question only if the owner's own message already says to go ahead (apply, go, do it, autopilot, every day, schedule it) or `brief` says `"mode":"auto"`. `"mode":"pause"` means do nothing.
3. **Never ship someone else's work.** `seo-log.mjs drift` must say `clean` (or the owner said "publish everything as it is"). Publishing deploys every unpublished edit in the site, not just yours. On `drift`: audit, propose, do not publish, name the changed files. If the owner says they already published those edits themselves: `seo-log.mjs rebaseline $SITE`, then continue (an unattended run cannot know, so it stays safe and says so every time).
4. **Edit with `$K files edit` only**, after `seo-backup.mjs backup`. Never `$K edit`, `$K create` or `modify_app` (Kleap's AI: it spends credits and rewrites more than you asked).
5. **Verify live or undo.** One publish per site per run; success = `"status":"published"` and `report.live_verified:true`; otherwise undo your edits (`seo-log.mjs undo`) and publish again.
6. **Never invent, never delete.** No made-up prices, phones, addresses, ratings, years. Never delete a page or section of the owner's (removing a file YOU created in this same run, to undo it, is the one exception), change a URL, add `noindex`, or touch `public/robots.txt`, `astro.config.mjs`, `package.json`, `src/layouts/Base.astro`.

## 1. Connect Kleap (once per machine, 1 minute)

```bash
node $SKILL_DIR/scripts/seo-doctor.mjs my-site.kleap.io      # checklist + the one next step
```
- **Not signed in, someone is at the keyboard:** `$K auth login`. It opens the browser (sign in, or create a Kleap account); the token stays inside the CLI and never passes through the model. No key to copy.
- **Unattended (cron, server, scheduled agent):** the owner creates a key at https://kleap.co/settings/api-key (preset **Full**; Read-only can audit but not fix) and stores it as the secret `KLEAP_API_KEY`. `401` / `403 INSUFFICIENT_SCOPE` means the key or an old login is wrong or too weak: `$K auth logout && $K auth login`, or a new Full key. Stop and say so; do not retry in a loop.
- **No shell (ChatGPT, Claude.ai, Grok app):** add the connector `https://kleap.co/api/mcp`, then use the matching file in `prompts/`.
- `fetch failed` / `ETIMEDOUT` on a flaky or IPv6-broken network: `export NODE_OPTIONS=--dns-result-order=ipv4first`, retry once.

**Which site.** The owner names it (id, slug, `x.kleap.io` URL or custom domain). None named: `$K list --limit 20`, show the published ones, ask which. For scheduled runs keep one site per line in `$SEO_HOME/sites.txt`.
**Never loop over "all apps of the account"** (accounts hold dozens of unpublished drafts and tests). No `src/pages/*.astro` (legacy Next.js): the audit exits 3; use Level 0 on its public URL.

## 2. Level 0: audit any site, no account

```bash
node $SKILL_DIR/scripts/seo-audit.mjs --url https://example.com          # add --json for machines
```
Read-only GET requests on the public pages (homepage + sitemap, 12 pages by default). Prints the checklist score (our own 0-100, not a Google metric), the top 3 problems with the fix for each, and growth ideas.
Then give the owner a first win, not a list: for the top problem write the exact new title (30-60 chars, main keyword first) and meta description (70-160) using only what the page already says, ready to paste.
Pages that exist for the product (login, billing, checkout...) are ignored on purpose, and a `noindex` page is only a note for the owner, never a fix. Then tell the owner the honest next step: fixing these automatically (edit, publish, verify, undo) works for sites hosted on Kleap; for any other host, the list is theirs to apply.
No Kleap site yet and they want one? `$K auth login` creates the account in the browser, and the sibling skill `kleap-build` (same repo) builds a site from a description; this skill takes over once it is published.

## 3. Level 1, first run on a site (attended, about 2 minutes)

```bash
SITE=<id|slug|url>
node $SKILL_DIR/scripts/seo-log.mjs pull $SITE                # memory saved in the site by earlier runs (any machine)
node $SKILL_DIR/scripts/seo-log.mjs brief $SITE               # first_run, mode, remaining_today, pairs not to touch, lessons, due_for_measure
node $SKILL_DIR/scripts/seo-log.mjs drift $SITE               # none (first run) | clean | drift
node $SKILL_DIR/scripts/seo-audit.mjs $SITE --live            # checklist score, TOP 3, WAITING, growth ideas, Search Console state
```
0. **Search Console, day one.** If `brief`/the audit say it is not connected, tell the owner once: *"Without Search Console I can fix the basics but cannot tell you whether Google sends you more people. For a site on a `*.kleap.io` address it cannot be connected (the API answers `requires_custom_domain: true`); for a custom domain, `$K search-console connect $SITE` prints the one link to click."* Then go on: the loop still learns from analytics and from what the owner keeps or rewrites.
1. **Choose the fixes** (<= 3). The audit already skips what was fixed in the last 14 days and what was reverted in the last 30. The audit ranks by impact (10 missing title, missing description, live page errors; 9 dead links, Google low-CTR rewrites, `noindex`; 8 duplicates; then no `<h1>`, orphan pages, short titles/descriptions, alt text, schema): take its TOP 3 as it is.
   How to write each one: `references/astro-seo-fixes.md`. Read the hero and about text first and keep the site's language, tone and product names. Apply `brief.lessons` and `owner_style` (section 5).
2. **Show the plan, then ask once** (rule 2):
   ```
   Your site scores 62/100 on the SEO checklist. These 3 matter most:
   1. / title (5 chars): "Hotel" -> "Hotel Kleap Prod Check — Deluxe Room & Rooftop Pool"
   2. / meta description: none -> "Stay at ... plan your next escape."
   3. menu link /spa (no such page): link removed, "Spa" text kept
   Apply these 3 and publish? Publishing also ships any other unpublished edit in the site. (yes / change something / no)
   ```
3. **On yes:** back up, apply, publish, verify:
   ```bash
   node $SKILL_DIR/scripts/seo-backup.mjs backup $SITE src/pages/index.astro           # every file you will change
   $K files cat $SITE src/pages/index.astro                                            # copy the exact old text
   $K files edit $SITE src/pages/index.astro --find "<old>" --replace "<new>"          # one call per fix
   $K publish $SITE --json                                                             # once
   node $SKILL_DIR/scripts/seo-audit.mjs $SITE --live                                  # each fixed finding gone, none new
   ```
   Read `report`: a NEW `broken_links`, `dead_nav_links` or `incoherent_pages` caused by your change is a failure. A warning that was there before your change is reported, not chased
   (a "broken image" warning can be stale: `curl -sI <live-url>/uploads/x.jpg`; a `200` means leave it). A `gsc_low_ctr` finding stays in the audit until Google re-crawls: verify it by the served `<title>` and description (they equal what you wrote), not by the finding disappearing.
   Undo: `node $SKILL_DIR/scripts/seo-log.mjs undo $SITE --apply && $K publish $SITE` reverses the exact find/replace pairs of the last run (from any machine) and leaves any text the owner has rewritten since; `seo-backup.mjs restore` is the whole-file fallback on the machine that made the backup. The pair is then blocked for 30 days.
4. **Log and save the memory**, every run, even when nothing was fixed. Per fix record `edits` (the exact `--find`/`--replace` you used: it is what makes undo work), `analytics_before` (the page's row from `$K analytics $SITE --period 30d --json`, every site has it) and `gsc_before` (the page's row from the audit's `gsc.top_pages`, only with Search Console). Those baselines are what makes learning possible. The memory format is `references/memory-format.md`:
   ```bash
   node $SKILL_DIR/scripts/seo-log.mjs add '{"site":"116838","name":"Hotel X","score":{"before":62,"after":88},"edits":[{"path":"src/pages/index.astro","find":"title=\"Hotel\"","replace":"title=\"Hotel X — Rooms & Rooftop\""}],"fixes":[{"page":"/","type":"title_short","before":"Hotel","after":"Hotel X — Rooms & Rooftop","analytics_before":{"views":40}}],"published":true,"live_verified":true,"reverted":false,"notes":""}'
   node $SKILL_DIR/scripts/seo-log.mjs snapshot $SITE        # only after a successful publish: the state we shipped
   node $SKILL_DIR/scripts/seo-log.mjs push $SITE            # memory goes into the site (.kleap/seo-autopilot.json, not published)
   ```
5. **Report** (3-6 lines per site): checklist before -> after, each change as before -> after, the live URL, what you skipped and why, what needs a human, and what happens next (tomorrow: what it will look at). Save it as `$SEO_HOME/reports/<date>.md` and send it through the channel the owner already reads (the chat reply of a ChatGPT task, `--announce` on OpenClaw, a mail or chat tool if you have one): a report that lands only in a log file is not delivered.
6. **Offer the habit:** "Want this every morning? Say *autopilot* and I will switch this site to automatic and give you the one line that schedules it on <your agent>." On yes: `node $SKILL_DIR/scripts/seo-log.mjs mode $SITE auto`, `push`, then the schedule line (section 7).

A clean site (0 findings) is a win, not "nothing to do": report the score, then offer the first growth idea (section 6).

## 4. Every day after that (autopilot)

Same steps without the question: `pull`, `brief` (stop if paused or `remaining_today` is 0), `drift` (on `drift`: propose only), audit, fix <= 3, backup, publish once, verify, log, snapshot, push, report.
When nothing changed and nothing needs the owner, the daily report is ONE line (`<site>: 100/100, nothing to fix`); the full report is Monday's. Every report ends with `node $SKILL_DIR/scripts/seo-log.mjs weekly | head -3` on Mondays: it warns when a site in autopilot has not run for 2+ days, so a stopped schedule is noticed.
Max 3 fixes per site per day, max 5 files touched, one publish per run (you keep these; `brief` only counts fixes). If `brief` says `"mode":"propose"` in an unattended run: audit, write the plan into the report, apply nothing.
**Pause:** `node $SKILL_DIR/scripts/seo-log.mjs mode $SITE pause` (owner says "stop", or you cannot tell what is going on). It is saved inside the site, so every machine that runs this skill stops at its next `pull`.

## 5. Learn between runs

The memory lives in the site (`.kleap/seo-autopilot.json`), so a scheduled run on a fresh machine, a container or a cloud routine starts with the full history (`pull`). `brief` gives you what the history taught:
- `lessons.dropped`: do not use those fix types on this account without asking. `lessons.doubleDown`: prefer them. `owner_style`: when the owner replaced one of your titles or descriptions, their wording is the style guide for the next one. `reverted_last_30d` and `touched_last_14d`: leave them alone.
- `due_for_measure` not empty: run the command in `hint` (audit JSON + Search Console + analytics -> `seo-log.mjs measure`). Per fix it records, from day 3, did the owner **keep** your wording; from day 28, did **Google** move on that page (a 28-day window that starts after the fix vs the 28 days before it, per-day rates, only judged with >= 100 impressions; a 7-day window from day 14 is an "early read"); else, from day 30, did page **traffic** move (all sources, weaker evidence). The result feeds `lessons`.
- Read the numbers like this (`references/diagnosis.md`): many impressions + low CTR = rewrite title and description; good CTR + few impressions = the page needs content and links (a Level 2 proposal); position > 20 = content, not metadata.
- Under 100 clicks in 28 days: say "too little data to conclude". Never invent a trend. Search Console needs a custom domain and one click by the owner (`$K search-console connect $SITE` prints the consent link); say this on day one, not in week two.

## 6. Level 2: grow (proposals only)

When the checklist passes (or after a week of fixes), pick ONE idea from the audit's `GROWTH IDEAS` (`references/growth-mode.md`): a dedicated page for a service/room/product the site already mentions,
an FAQ block from questions the owner confirms, a section answering a Google query the site shows for but never mentions, `llms.txt`. Write the proposal (outline + the exact text, only facts the site shows)
into the report and wait for the owner's yes. Then: backup, `files write` the new file, one internal link to it, publish, verify, log. Never more than one per week; never without the owner's yes.

## 7. Schedule it, then the weekly report

`node $SKILL_DIR/scripts/seo-schedule.mjs <claude|codex|grok|openclaw|hermes> [--launchd]` prints the right line for THIS machine: absolute paths and PATH (cron starts with an almost empty one, so a bare `claude` or `npx` fails silently), the key in a mode-600 env file instead of the crontab, the report written to a dated file. It prints and installs nothing.

| Your agent | The one line | Details |
|---|---|---|
| Claude Code | `node scripts/seo-schedule.mjs claude` (cron) or `... claude --launchd` (Mac) | `prompts/claude.md` |
| Codex | `node scripts/seo-schedule.mjs codex`, or a scheduled task with the same sentence (skill in `~/.agents/skills`) | `prompts/chatgpt-scheduled-task.md` |
| Grok Build | `node scripts/seo-schedule.mjs grok` (one run takes minutes: allow for it) | `prompts/grok-bot.md` |
| OpenClaw / Hermes | `node scripts/seo-schedule.mjs openclaw` (its own scheduler, report announced to your chat) | `prompts/openclaw-hermes.md` |
| ChatGPT / Claude.ai (no shell) | scheduled task or routine on the MCP connector | `prompts/chatgpt-scheduled-task.md`, `prompts/claude.md` |

**Mondays (or when asked), the weekly report:**
```bash
node $SKILL_DIR/scripts/seo-log.mjs weekly                 # shipped, checklist trend, measured, learned
$K search-console $SITE --period 7d                        # clicks, impressions, CTR, position, top queries and pages
$K analytics $SITE --period 7d                             # visitors and pageviews, all sources
```
Say what shipped, what Google shows, what you learned (one line), the growth idea of the week, what you do next.

## 8. Risks, rules, mistakes

- **What leaves your machine:** calls to kleap.co through the Kleap CLI, and plain GET requests on the site you audit. Nothing else. The key is read by the CLI, never by the model. The memory file contains only the log of what this skill changed (before -> after text).
- **Risk: an unattended agent edits a live site.** Mitigations: propose-first, drift guard, 3 fixes and one publish per run, backups, verified-live check, automatic undo, 14/30-day cool-downs, pause switch, hard rules above. Nothing paid, nothing irreversible: never buy or connect domains, change plans, or run `create` / `edit`.
- **Risk: wrong tone or a wrong claim in a title.** It only reuses facts the site shows; the owner sees every before -> after in the report and can say "revert". Titles 30-60 chars (main keyword first), descriptions 70-160, unique per page, in the site's language, no keyword stuffing.
- **Errors:** auth or scope error -> stop and tell the owner. Transient `fetch failed` -> retry once. Anything else unexpected -> stop, log it, report it. Do not loop.

| Mistake | Fix |
|---|---|
| Used `$K edit` (Kleap's AI) | It costs credits and rewrites pages. Use `files edit` with an exact `--find`. |
| `--find` text not found | `files cat` first, copy the exact bytes (quotes, `&`, line breaks). |
| Rewrote the same page two days in a row | The audit now skips pairs fixed in the last 14 days. |
| Re-fixed something that was reverted | Reverted pairs are blocked 30 days; ask the owner. |
| Reverted a good `gsc_low_ctr` fix because the finding was still there | It stays until Google re-crawls. Check the served title/description instead. |
| Published while the owner had unpublished edits | `drift` first. On `drift`, propose only. |
| Fixed a dead link by deleting the menu item | Retarget to an equivalent existing page/section, or keep the text unlinked and tell the owner. |
| Reported "improved" with no data | Under 100 clicks in 28 days: "too little data". |
| Looped over every app of the account | Only sites named by the owner or in `sites.txt`. |

## 9. Tools used (CLI <-> MCP)

Run against production with a test account (2026-10-18). Not run here: `auth login` (needs a browser) and Search Console on a connected property (only the "not connected" answer was seen).

| Step | CLI | MCP tool |
|---|---|---|
| connect | `auth login`, `auth key`, `auth status`, `credits` | `get_credits` |
| find / state | `status`, `list` | `find_app`, `list_apps`, `get_app` |
| read source | `files ls`, `files cat` | `list_app_files`, `read_files` |
| fix | `files edit`, `files write` | `edit_files`, `write_files` |
| publish + check | `publish`, `status` | `publish_app` (may answer `deploying` with no report: wait ~45 s, then `get_publish_status` once) |
| Google data | `search-console [connect]` | `get_search_console`, `connect_search_console` |
| traffic | `analytics --period 7d` | `get_analytics` |

There is no dedicated "SEO audit" tool: the audit is `scripts/seo-audit.mjs` (your source files + Search Console) plus the publish report (`report.seo`).
Search Console gives top queries and top pages as two separate lists (10 each), not page x query.
