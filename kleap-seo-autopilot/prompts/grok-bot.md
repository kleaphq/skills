# Kleap SEO autopilot with Grok

**Does Grok support remote MCP? Yes, on two surfaces we checked.** A third (the grok.com / X chat app) is unknown, see the end.

| Surface | Remote MCP | Verified by us |
|---|---|---|
| **Grok Build CLI** (`grok`, headless `grok -p`) | `grok mcp add <name> <https-url> -H "Header: value"`, streamable HTTP | **Yes, run live** (34 tools discovered, tools called, skill followed end to end) |
| **xAI API** (`POST https://api.x.ai/v1/responses`, tool `type: "mcp"`) | `server_url`, `server_label`, `allowed_tools`, `headers`, `authorization`; streamable HTTP and SSE only; `require_approval` and `connector_id` are not supported | Docs only (docs.x.ai/developers/tools/remote-mcp), **not run: we have no xAI API key** |
| grok.com / X app | not documented anywhere we could confirm | **Unknown. Do not promise it.** |

## A. A Grok bot that runs the skill (recommended; this is the tested path)

```bash
# 1. a Full-preset key from https://kleap.co/settings/api-key (it only ever sees YOUR sites)
export KLEAP_API_KEY=kleap_live_sk_...

# 2. give Grok the Kleap tools at USER scope (a project-scoped server is NOT loaded in an "untrusted folder", we hit that)
grok mcp add -s user kleap https://kleap.co/api/mcp -H "Authorization: Bearer $KLEAP_API_KEY"
grok mcp doctor kleap            # expect: handshake OK, 34 tools discovered

# 3. the skill (Grok Build reads Agent Skills, including ~/.claude/skills) and the sites to improve
mkdir -p ~/.claude/skills ~/.kleap-seo && cp -R kleap-seo-autopilot ~/.claude/skills/
printf '%s\n' mysite.ch rivera-family-plumbing.kleap.io > ~/.kleap-seo/sites.txt

# 4. run it headless (this is what a cron / launchd / systemd timer calls)
grok -p "Use the kleap-seo-autopilot skill: run its daily loop once for the sites in ~/.kleap-seo/sites.txt, then give me the owner report. On Mondays also give the weekly summary." \
  --always-approve --max-turns 40 --disable-web-search
```
Tested run (grok-4.7, a seeded test site): it read `SKILL.md`, audited, backed the file up, fixed the 22-character title, published once,
saw `live_verified: true`, re-audited to 0 findings, logged the change, and reported honestly that Search Console was not connected.
Daily at 07:07: `7 7 * * * KLEAP_API_KEY=... grok -p "<same prompt>" --always-approve --max-turns 40 >> ~/.kleap-seo/cron.log 2>&1`.
`--always-approve` lets it run the CLI and scripts without asking: use a Full key that belongs to the account whose sites it may edit, nothing else.
With only `grok mcp add` and no skill, the same prompt as in `claude.md` ("Prompt for the connector route") works through the MCP tools.

## B. A bot built on the xAI API (not run by us, written from the docs)

```bash
curl https://api.x.ai/v1/responses \
  -H "Authorization: Bearer $XAI_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "model": "grok-4.7",
    "input": "<the prompt from claude.md, with your SITES filled in>",
    "tools": [{
      "type": "mcp",
      "server_url": "https://kleap.co/api/mcp",
      "server_label": "kleap",
      "server_description": "Kleap: read, edit and publish my websites",
      "allowed_tools": ["find_app","get_app","list_app_files","read_files","edit_files","publish_app","get_publish_status","get_search_console"],
      "headers": { "Authorization": "Bearer kleap_live_sk_..." }
    }]
  }'
```
- `allowed_tools` is the guardrail that matters: it leaves the bot unable to `create_app`, `modify_app`, `buy_domain`, `upgrade_plan` or delete anything.
- Use `headers` for the Kleap key. The doc says `authorization` is "a token that will be set in the Authorization header" without saying
  whether `Bearer ` is added for you, so we did not rely on it.
- Run it from your scheduler (cron, GitHub Actions, a worker). The API is stateless: log the answer yourself if you want the weekly summary
  (`seo-log.mjs` needs a shell; with the API keep the answers in your own storage).
- The model name (`grok-4.7` is the default of the Grok CLI today) changes often: check `grok models` or docs.x.ai before pinning.
- A long loop makes many tool calls; xAI documents a tool-count limit only in third-party guides, so keep `allowed_tools` short and handle a few sites per call.

## What we could not confirm

- Whether the grok.com / X chat app accepts custom MCP connectors or scheduled tasks. Until xAI documents it, offer Grok users path A or B.
- The xAI API request above has not been executed. Run it once on one test site before telling anyone it works.
