# Kleap SEO autopilot as a ChatGPT scheduled task (10-15 client sites)

## Status, read this first

- **Kleap's official ChatGPT app (plugin) is NOT approved yet** (submitted, changes required on 2026-10-02, corrected and
  re-sent 2026-10-15, still "Not published"). When it is approved: Settings -> Apps -> Kleap -> Connect, and nothing else below changes.
- **Route that works today: a custom connector** (paid ChatGPT plan: Plus, Pro, Business or Enterprise; custom MCP connectors need Developer mode).
  1. ChatGPT -> Settings -> Apps (Connectors) -> Advanced -> turn on **Developer mode** -> **Create**.
  2. Name `Kleap`, MCP server URL `https://kleap.co/api/mcp`, authentication **OAuth** (ChatGPT discovers it by itself; Kleap supports dynamic client registration).
  3. Sign in to Kleap in the popup, **Approve**. The 34 Kleap tools appear in the connector.
- **What we verified:** the MCP endpoint, OAuth discovery and all tools used below (run against production with a test account).
  OpenAI's docs say scheduled tasks created in ChatGPT Work (web) or the desktop app can use plugins and skills; third-party guides
  report that custom MCP connectors also work inside scheduled tasks. **Not verified by us: a custom connector executing inside a
  scheduled task.** Check it once: create the task, press **Run now**, and read the result in **Scheduled**. If the connector is not
  available there, use the Codex route below.
- Tool names ChatGPT shows: `list_apps`, `find_app`, `get_app`, `list_app_files`, `read_files`, `edit_files`, `publish_app`,
  `get_publish_status`, `get_search_console`. (There is no separate SEO-audit tool: the audit is the checklist in the prompt.)

## The task

Create it from a chat ("schedule this every day at 7:07") or in **Scheduled**. A task starts a NEW chat for every run and keeps no
memory, so the prompt is built to need none: each site is tagged with the weekdays it is handled (3 sites per day for 10-15 sites keeps a run
inside ChatGPT's time limit), Search Console rewrites happen on Mondays only, and the audit is state-based (a fixed problem is gone next run).

Paste, then replace the SITES block:

```text
You are my SEO autopilot for websites built on Kleap. Work only through the Kleap connector.
Today is {{today's date and weekday}}.

SITES. Handle ONLY the sites whose tag contains today's weekday:
- rivera-plumbing.com [Mon, Thu]
- brightsmile.kleap.io [Mon, Thu]
- oakember.fr [Tue, Fri]
- ... (3-5 sites per weekday)

For each site to handle:
1. find_app(query) -> app_id. get_app: no production_url means not published: skip and say so.
2. AUDIT (read-only). list_app_files, then read_files on every src/pages/*.astro except 404, plus src/components/Header.astro and
   Footer.astro if present. Per page check: <Base title=...> is 30-60 chars and unique; description=... is 70-160 chars and unique; exactly one
   <h1>; every <img> has alt; every internal href="/..." targets an existing page; the homepage passes a schema={[...]} prop; about 120+
   visible words. On Mondays also call get_search_console(app_id): a query with >= 100 impressions, CTR < 2% and position <= 20 means the
   page ranking for it needs a better title and description (the tool lists top queries and top pages separately: read the top page to be sure).
   If connected is false write "Search Console not connected" and move on.
3. Choose the 3 highest-impact problems. Order: missing title/description and dead links > low-CTR rewrites > duplicates > alt text > schema > thin pages.
4. Fix them with ONE edit_files call per site (old_string copied exactly from read_files; never write_files over an existing file).
5. publish_app(app_id). If it answers "deploying" with no report, wait about 45 seconds and call get_publish_status once (twice at most) to read the report.
   Success = status "published", report.live_verified true, and no NEW broken_links, dead_nav_links or incoherent_pages caused by you.
6. If publishing fails or you caused a new problem: undo with edit_files (swap old/new text), publish_app again, and report it.

Rules: max 3 fixes per site per run. Never delete a page or section, change a URL, add noindex, or touch robots.txt, astro.config.mjs, package.json,
src/layouts/Base.astro. Keep each site's language, tone, product names (read the hero text first). Never invent facts (prices, phone, address, ratings,
years). No keyword stuffing. Nothing paid: never call create_app, modify_app, buy_domain, upgrade_plan.
If a tool returns 401 or 403 INSUFFICIENT_SCOPE: stop and tell me to reconnect Kleap in Settings -> Apps.

Final answer, per site: name, live URL, each change as "page: before -> after", what you skipped and why, what needs me.
On Mondays add 3 lines: "this week" across all sites.
```

## Route that works today without the connector question: Codex scheduled task + the skill

Codex (ChatGPT desktop app / Codex CLI) runs real shell, supports skills and MCP, and has scheduled tasks:
```bash
mkdir -p ~/.agents/skills && cp -R kleap-seo-autopilot ~/.agents/skills/   # Codex user skills folder (or <repo>/.agents/skills)
export KLEAP_API_KEY=kleap_live_sk_...                          # Full preset key, https://kleap.co/settings/api-key
codex mcp add kleap --url https://kleap.co/api/mcp --bearer-token-env-var KLEAP_API_KEY   # (flags tested with `codex mcp add --help`)
```
Then schedule "Use the kleap-seo-autopilot skill: run its daily loop once for the sites in ~/.kleap-seo/sites.txt" from the
Scheduled view. The skill keeps its own log, so it needs no weekday trick.
