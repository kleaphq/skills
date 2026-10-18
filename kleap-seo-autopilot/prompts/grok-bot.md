# Kleap SEO autopilot with Grok

**Does Grok support remote MCP? Yes, on two surfaces we checked.** A third (the grok.com / X chat app) is unknown, see the end.

| Surface | Remote MCP | Verified by us |
|---|---|---|
| **Grok Build CLI** (`grok`, headless `grok -p`) | `grok mcp add <name> <https-url> -H "Header: value"`, streamable HTTP | **Yes, run live** (34 tools discovered, tools called, skill followed end to end) |
| **xAI API** (`POST https://api.x.ai/v1/responses`, tool `type: "mcp"`) | `server_url`, `server_label`, `allowed_tools`, `headers`, `authorization`; streamable HTTP and SSE only; `require_approval` and `connector_id` are not supported | Docs only (docs.x.ai/developers/tools/remote-mcp), **not run: we have no xAI API key** |
| grok.com / X app | not documented anywhere we could confirm | **Unknown. Do not promise it.** |

## A. A Grok bot that runs the skill (recommended; this is the tested path)

```bash
# 1. a Full-preset key from https://kleap.co/settings/api-key (it only ever sees YOUR sites). Store it as a secret; never paste it in a chat.
export KLEAP_API_KEY=kleap_live_sk_...

# 2. the skill, at USER level. Grok Build loads user skills from ~/.grok/skills and ~/.claude/skills. A skill inside a project folder (.claude/skills/ next to your files) is NOT loaded
#    while the folder is untrusted (`grok inspect` prints "Project trusted: no"): we hit that, and the agent answered "there is no such skill". Check with `grok inspect | grep kleap`.
mkdir -p ~/.grok/skills && cp -R kleap-seo-autopilot ~/.grok/skills/      # or: npx skills add kleaphq/skills --skill kleap-seo-autopilot -g -a claude-code (lands in ~/.claude/skills; works once kleaphq/skills has this version)
node ~/.grok/skills/kleap-seo-autopilot/scripts/seo-doctor.mjs my-site.kleap.io       # checklist + the ONE next step

# 3. first run by hand, so you approve the first changes (two separate calls: the second one carries your approval)
grok -p "Use the kleap-seo-autopilot skill on my-site.kleap.io. Show me the plan first and wait." --always-approve --max-turns 40 --disable-web-search
grok -p "Use the kleap-seo-autopilot skill on my-site.kleap.io. I approve: apply the top 3 fixes and publish. Then switch my-site.kleap.io to autopilot." --always-approve --max-turns 40 --disable-web-search

# 4. every day at 07:07, headless: prints the exact line for THIS machine (absolute paths + PATH, key in a mode-600 file, report in a dated file)
printf '%s\n' my-site.kleap.io > ~/.kleap-seo/sites.txt
node ~/.grok/skills/kleap-seo-autopilot/scripts/seo-schedule.mjs grok
```
A Grok Build run of this loop is slow: 2 min 48 s for the proposal and more than 15 minutes for the apply-and-publish call in `references/evidence/11-grok-build.md` (it was cut by our 15-minute limit just before it saved the memory), against about 2 minutes on Claude Code. Schedule it with a generous timeout (30 minutes or more) and one or two sites per run.
`--always-approve` lets it run the CLI and scripts without asking: use a Full key that belongs to the account whose sites it may edit, nothing else.
Optional, to let Grok use the Kleap tools directly as well: `grok mcp add -s user kleap https://kleap.co/api/mcp -H "Authorization: Bearer $KLEAP_API_KEY"` then `grok mcp doctor kleap` (expect 34 tools). Use `-s user`: a project-scoped server is not loaded in an "untrusted folder", we hit that.
With only `grok mcp add` and no skill, the prompt at the end of this file works through the MCP tools.

## B. A bot built on the xAI API (not run by us, written from the docs)

```bash
curl https://api.x.ai/v1/responses \
  -H "Authorization: Bearer $XAI_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "model": "grok-4.7",
    "input": "<the prompt at the end of this file, with your SITES filled in>",
    "tools": [{
      "type": "mcp",
      "server_url": "https://kleap.co/api/mcp",
      "server_label": "kleap",
      "server_description": "Kleap: read, edit and publish my websites",
      "allowed_tools": ["get_credits","find_app","get_app","list_app_files","read_files","edit_files","write_files","publish_app","get_publish_status","get_search_console","get_analytics"],
      "headers": { "Authorization": "Bearer kleap_live_sk_..." }
    }]
  }'
```
- `allowed_tools` is the guardrail that matters: it leaves the bot unable to call `create_app`, `modify_app`, `delete_files`, `buy_domain`, `upgrade_plan` or any database tool. `write_files` is in the list only for the memory file; the prompt says so, the list cannot enforce it, so keep the key's owner in mind.
- Use `headers` for the Kleap key. The doc says `authorization` is "a token that will be set in the Authorization header" without saying whether `Bearer ` is added for you, so we did not rely on it.
- Run it from your scheduler (cron, GitHub Actions, a worker). The API is stateless, but the prompt keeps its memory inside your site, so every run continues the last one.
- The model name (`grok-4.7` is the default of the Grok CLI today) changes often: check `grok models` or docs.x.ai before pinning.
- A long loop makes many tool calls; xAI documents a tool-count limit only in third-party guides, so keep `allowed_tools` short and handle a few sites per call.

## What we could not confirm

- Whether the grok.com / X chat app accepts custom MCP connectors or scheduled tasks. Until xAI documents it, offer Grok users path A or B.
- The xAI API request above has not been executed. Run it once on one test site before telling anyone it works.

## Prompt for the connector route (B, or A without the skill)

**Paste the prompt in [`connector-prompt.md`](connector-prompt.md)** (one copy for every agent: fill in your site address, nothing else).
