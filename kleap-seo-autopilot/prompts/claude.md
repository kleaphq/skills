# Kleap SEO autopilot on Claude (Claude Code, Claude Desktop / claude.ai)

Three ways, from most to least hands-off. Tested items are marked (tested); the rest follows Anthropic's docs.

## A. Claude Code on your machine or a server (skill + CLI) — recommended

```bash
# 1. install the skill (copy the folder; Claude Code also reads ~/.claude/skills)
mkdir -p ~/.claude/skills && cp -R kleap-seo-autopilot ~/.claude/skills/

# 2. connect Kleap once. Attended: browser OAuth. Unattended: a Full-preset key from https://kleap.co/settings/api-key
npx -y kleap-cli@latest auth login            # (tested with KLEAP_API_KEY; the browser flow is documented, not run headless)
export KLEAP_API_KEY=kleap_live_sk_...        # for cron / launchd / servers

# 3. list the sites to improve (one id, slug or domain per line)
mkdir -p ~/.kleap-seo && printf '%s\n' mysite.ch rivera-family-plumbing.kleap.io > ~/.kleap-seo/sites.txt

# 4. run it once, headless (tested: a fresh Claude Code session followed the skill end to end on a test site)
claude -p "Use the kleap-seo-autopilot skill: run its daily loop once for the sites in ~/.kleap-seo/sites.txt, then give me the owner report." \
  --permission-mode acceptEdits --allowedTools "Bash" --max-turns 60
```
Daily at 07:07 with cron: `7 7 * * * KLEAP_API_KEY=... claude -p "<same prompt>" --allowedTools "Bash" >> ~/.kleap-seo/cron.log 2>&1`.
`--allowedTools "Bash"` lets the skill run its scripts and the kleap CLI. Weekly summary: add "On Mondays also give the weekly summary." to the prompt.

## B. Claude Code Routine (runs in Anthropic's cloud, laptop closed)

Routines are in research preview, on Pro / Max / Team / Enterprise, minimum interval 1 hour, and they use the
connectors of your claude.ai account (a server added with `claude mcp add` is NOT visible to a routine).
1. claude.ai -> Customize -> Connectors -> **Add custom connector** -> `https://kleap.co/api/mcp` -> Connect -> sign in to Kleap -> Approve.
   (The Claude-directory version of the connector, `https://kleap.co/api/mcp/claude`, has 29 tools instead of 34; the five it leaves
   out are `generate_image`, `buy_domain`, `upgrade_plan`, `run_database_sql`, `wake_app`. The SEO loop uses none of them.)
2. In Claude Code run `/schedule`, or create the routine at claude.ai/code/routines: trigger **Schedule -> Daily at 07:07**
   (avoid exact :00, runs can start minutes late), keep only the Kleap connector, paste the prompt below.
The routine cannot run the npm CLI against kleap.co unless you widen its network access, so it uses the connector tools (prompt below).

## C. Claude Desktop / claude.ai chat, on demand

Add the same custom connector (step B1), then paste the prompt below in a chat whenever you want a pass.

## Prompt for the connector route (B and C)

```text
You are my SEO autopilot for websites built on Kleap. Work only through the Kleap connector tools.
Today is {today}.

SITES (address on Kleap or custom domain):
- {site 1}
- {site 2}

For each site, in order:
1. find_app(query) -> app_id. get_app: if there is no production_url the site is not published: skip it and say so.
2. AUDIT (read-only): list_app_files, then read_files on every src/pages/*.astro (except 404) plus
   src/components/Header.astro and Footer.astro if they exist. Check per page: <Base title=...> 30-60 chars and unique; description=...
   70-160 chars and unique; exactly one <h1>; every <img> has alt; every internal href="/..." points to an existing page; the homepage
   passes a schema={[...]} prop; about 120+ visible words. Then get_search_console(app_id): if connected and a query has >= 100
   impressions, CTR < 2% and position <= 20, the page that ranks for it needs a better title/description (only on Mondays, so a page is
   not rewritten every day). If connected is false, just note "Search Console not connected" (do not call connect_search_console).
3. Pick the 3 highest-impact problems. Order: missing title/description, dead internal links > low-CTR rewrites > duplicates > alt text > schema > thin pages.
4. Fix them with ONE edit_files call per site (old_string copied exactly from read_files; never write_files over an existing file).
5. publish_app(app_id). If it answers "deploying" with no report, wait about 45 seconds and call get_publish_status once (twice at most) to read the report.
   Success = status "published", report.live_verified true, and no NEW broken_links / dead_nav_links / incoherent_pages caused by you.
6. If publish fails or you introduced a problem: undo with edit_files (swap old and new text), publish_app again, and say so.

Rules: at most 3 fixes per site per run. Never delete a page or a section, never change a URL, never add noindex, never touch robots.txt,
astro.config.mjs, package.json or src/layouts/Base.astro. Keep each site's language, tone and product names; read the hero text before rewriting copy.
Never invent facts (prices, phone, address, ratings, years). No keyword stuffing. Nothing paid: no create_app, modify_app, buy_domain, upgrade_plan.
If a tool answers 401 or 403 INSUFFICIENT_SCOPE, stop and tell me to reconnect the Kleap connector.

Final answer, per site: name and live URL; each change as "page: before -> after"; what you skipped and why; anything needing me
(e.g. Search Console not connected). On Mondays add a 3-line "this week" summary.
```
