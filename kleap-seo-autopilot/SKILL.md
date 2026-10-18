---
name: kleap-seo-autopilot
description: >-
  Your agent improves your Kleap websites' SEO every day. It audits each site, fixes the 3 highest-impact
  problems (page titles, meta descriptions, missing image alt text, dead or missing internal links, JSON-LD
  schema, thin pages, Google queries with many impressions but few clicks), publishes with a verified-live
  check, keeps a change log, reverts anything that breaks, and sends a weekly summary. Use when the user says
  "improve my SEO", "run my SEO routine", "SEO autopilot", "keep my site optimized", or schedules a recurring
  agent task on websites built with Kleap. Costs 0 Kleap credits (direct file edits).
version: 0.1.0
license: MIT
compatibility: "Claude Code, OpenClaw, Hermes Agent, Codex, Grok Build and any Agent Skills client with a shell and Node >= 18. MCP-only agents (ChatGPT, Claude.ai, Grok API) use the same loop with the Kleap MCP tools, see prompts/."
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
        description: "kleap_live_sk_... key (Full preset) for unattended runs. Not needed after `kleap auth login`."
---

# Kleap SEO autopilot

A daily loop that makes your Kleap sites a little better in Google every day, without you. For each site:
**audit -> fix the 3 best things -> publish (verified live) -> log -> weekly summary.** Everything is a direct file
edit through Kleap's API, so it costs **0 Kleap credits** and changes only what it names.

`SKILL_DIR` = the folder containing this file. `SEO_HOME` = `${KLEAP_SEO_HOME:-$HOME/.kleap-seo}` (sites list, backups, log). `K` = `npx -y kleap-cli@latest` (or `kleap` after `npm i -g kleap-cli`,
then `export KLEAP_BIN=kleap`). Every command accepts `--json`; exit code 0 = ok, 1 = failure.

## 0. Connect Kleap (once per machine)

```bash
K="npx -y kleap-cli@latest"
$K auth status || echo "not signed in"
```
- **Attended machine:** `$K auth login` (opens the browser, OAuth, nothing to paste).
- **Unattended (cron, server, scheduled agent):** create a key at https://kleap.co/settings/api-key with the **Full**
  preset, put it in the agent's secret store as `KLEAP_API_KEY=kleap_live_sk_...` (a Read-only key can audit but cannot fix).
- **MCP-native agent without a shell:** add the connector `https://kleap.co/api/mcp` (OAuth) and follow `prompts/`.
- Check: `$K credits` prints the plan and balance. `fetch failed` / `ETIMEDOUT` on a flaky or IPv6-broken network:
  `export NODE_OPTIONS=--dns-result-order=ipv4first`, retry once.

Which sites: keep one site per line (id, slug, `x.kleap.io` URL or custom domain) in `$SEO_HOME/sites.txt`.
If the file does not exist, run `$K list --limit 50`, ask the owner which published sites to include, save them.
**Never loop over "all apps of the account"** (accounts hold dozens of unpublished drafts and tests).
The audit works on Astro sites (every site Kleap builds today); on a legacy Next.js site it prints "no src/pages found" and exits 3: skip it.

## 1. The daily loop (repeat for each site in sites.txt)

```bash
SITE=116838                                   # id, slug, URL or domain from sites.txt
node $SKILL_DIR/scripts/seo-log.mjs budget $SITE   # {"fixes_today":N,"remaining_today":3-N,"touched_last_14d":[...]}
$K status $SITE                               # must print "live: https://..." else skip the site and say why
node $SKILL_DIR/scripts/seo-audit.mjs $SITE --live        # audit (read-only), prints TOP 3 + other findings + GSC state
```

1. **Budget.** If `remaining_today` is 0, stop for this site. Do not touch a `page|type` pair listed in `touched_last_14d`.
2. **Audit.** Read the TOP 3 (`--json` gives every finding with `page`, `type`, `detail`, `fix`). Types: `missing_title`,
   `title_short/long`, `missing_description`, `description_short/long`, `duplicate_title/description`, `no_h1`,
   `multiple_h1`, `missing_alt`, `dead_internal_link`, `orphan_page`, `thin_page`, `no_page_schema`, `gsc_low_ctr`,
   `live_title_differs`, `live_not_200`. It also reads Google Search Console when connected; if it prints
   `GSC: not connected`, say so in the report (connecting needs a custom domain and one click by the owner:
   `$K search-console connect $SITE` prints the consent link). Pages with dynamic routes (`[slug].astro`) are listed as skipped.
3. **Pick at most 3 fixes** (the TOP 3 unless a guardrail below says no). Order: broken things first (missing title or
   description, dead links, live errors) > `gsc_low_ctr` > duplicates > alt text > schema > thin pages.
   How to write each fix: `references/astro-seo-fixes.md` (the title, alt, dead-link and schema commands were run live on production; the other recipes use the same `files edit` pattern).
4. **Back up** every file you are about to change:
   `mkdir -p $SEO_HOME/backups/$SITE && $K files cat $SITE src/pages/index.astro --json > $SEO_HOME/backups/$SITE/index.astro.$(date +%F).json`
5. **Apply** with `$K files cat` (read, copy the exact old text) then `$K files edit $SITE <path> --find "<old>" --replace "<new>"`.
   Never use `$K edit` / `modify_app` (Kleap's AI): it costs credits and rewrites more than you asked.
6. **Publish once** per site: `$K publish $SITE --json`. Success = `"status":"published"` and `report.live_verified:true`.
   Read `report`: any NEW `broken_links`, `dead_nav_links` or `incoherent_pages` that your change caused counts as a failure.
   Findings that were already there before your change are reported, not chased; a "broken image" warning can be stale,
   so request the image URL (`curl -sI <live-url>/uploads/x.jpg`): a `200` means leave it alone and just mention it.
7. **Verify:** `node $SKILL_DIR/scripts/seo-audit.mjs $SITE --live` again. Each fixed finding must be gone, no new one added.
8. **Revert if** publish fails (`✗`, exit 1), `live_verified` is false, your change added a broken/dead link, or the
   re-audit does not show the fix: put the backup back and publish again.
   `node -e 'const j=require(process.argv[1]);process.stdout.write(j.files[0].content)' $SEO_HOME/backups/$SITE/index.astro.<date>.json > /tmp/restore.astro && $K files write $SITE src/pages/index.astro --file /tmp/restore.astro && $K publish $SITE`
9. **Log** (even when nothing was fixed):
   ```bash
   node $SKILL_DIR/scripts/seo-log.mjs add '{"site":"116838","name":"Hotel X","fixes":[{"page":"/","type":"title_short","before":"Hotel","after":"Hotel X — Rooms & Rooftop"}],"published":true,"live_verified":true,"reverted":false,"gsc":{"clicks":12,"impressions":900},"notes":""}'
   ```
10. **Report** to the owner in 3-6 lines per site: what changed (before -> after), live URL, anything skipped and why,
    anything that needs a human (GSC not connected, a broken image the audit cannot fix).

## 2. Weekly summary (Mondays, or when asked)

```bash
node $SKILL_DIR/scripts/seo-log.mjs weekly            # fixes kept, reverts, GSC first-vs-last snapshot per site
$K search-console $SITE --period 7d --json            # clicks, impressions, CTR, position, top queries/pages
$K analytics $SITE --period 7d                        # visitors and pageviews (all sources, not only Google)
```
Say what shipped, what Google shows now, and what you will do next. Search Console data lags 2-3 days and is thin on
small sites: under 100 clicks in 28 days, state "too little data to conclude" instead of inventing a trend.

## 3. Guardrails (hard rules, no exceptions)

- **Max 3 fixes per site per day, max 5 files touched, one publish per run.** Enforced by `seo-log.mjs budget`.
- **Never delete a page or a section** (`files rm` is out of scope), never rename a URL or slug, never add `noindex`,
  never edit `public/robots.txt`, `astro.config.mjs`, `package.json`, `src/layouts/Base.astro`.
- **Keep the brand voice and the language** of the site (a French site gets French titles). Read the hero and about
  text before rewriting any copy. Keep product names, tone, spelling.
- **Never invent facts:** no prices, phone numbers, addresses, ratings, review counts, awards, years in copy or schema.
  Schema and copy only use what the site already shows.
- No keyword stuffing; titles 30-60 chars (main keyword first), descriptions 70-160 chars, unique per page.
- Nothing paid, nothing irreversible: never buy or connect domains, never change plans, never call `$K create` or `$K edit`.
- Auth or scope error (`401`, `403 INSUFFICIENT_SCOPE`): stop and tell the owner to create a new Full key. Transient
  `fetch failed`: retry once. Anything else unexpected: stop, log it, report it. Do not loop.

## 4. Tools used (CLI <-> MCP)

Run against production with a test account (2026-10-18). Not run: `auth login` (browser flow), `write_files` and `connect_search_console` through MCP
(their CLI equivalents ran), and Search Console with a connected property (only the "not connected" answer was seen; the connected response shape is read from the API source).

| Step | CLI | MCP tool |
|---|---|---|
| connect | `auth login`, `auth key`, `auth status`, `credits` | `get_credits` |
| find / state | `status`, `list` | `find_app`, `list_apps`, `get_app` |
| read source | `files ls`, `files cat` | `list_app_files`, `read_files` |
| fix | `files edit`, `files write` | `edit_files`, `write_files` |
| publish + check | `publish`, `status` | `publish_app` (may answer `deploying` with no report: wait ~45 s, then `get_publish_status` once for the report) |
| Google data | `search-console [connect]` | `get_search_console`, `connect_search_console` |
| traffic | `analytics --period 7d` | `get_analytics` |

There is no dedicated "SEO audit" tool: the audit is `scripts/seo-audit.mjs` (reads your source files and Search
Console) plus the publish report (`report.seo`: JSON-LD pages, sitemap URL count, robots, llms.txt). Search Console
gives top queries and top pages separately (10 each), not page x query.
