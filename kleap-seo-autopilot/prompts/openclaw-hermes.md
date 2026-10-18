# Kleap SEO autopilot on OpenClaw and Hermes Agent

Both agents have a shell, load Agent Skills (`SKILL.md`) and have a built-in scheduler, so they use the skill + CLI route
(no MCP needed). The skill keeps its own log, so a scheduled run needs no memory.

## OpenClaw  (commands checked against OpenClaw 2026.4.15 `--help` and docs.openclaw.ai)

```bash
# 1. install the skill. OpenClaw 2026.4.15 (what we have) installs ClawHub slugs only: `skills install ./folder` answers
#    "Invalid skill slug" (the docs describe ./path and git: installs for newer builds). So copy the folder (copy-in not run by us):
mkdir -p ~/.openclaw/skills && cp -R kleap-seo-autopilot ~/.openclaw/skills/      # shared by all local agents; or <workspace>/skills/
#    after publication on ClawHub:  openclaw skills install @kleap/kleap-seo-autopilot   (ClawHub org handle is `kleap`, same as the existing `kleap` skill)
openclaw skills list --eligible                            # kleap-seo-autopilot must appear (needs node + npx)

# 2. the key. Full-preset key from https://kleap.co/settings/api-key. In ~/.openclaw/openclaw.json:
#    skills: { entries: { "kleap-seo-autopilot": { apiKey: "kleap_live_sk_..." } } }     (primaryEnv = KLEAP_API_KEY)
#    or export KLEAP_API_KEY in the gateway's environment. Attended alternative: npx -y kleap-cli@latest auth login

# 3. the sites
mkdir -p ~/.kleap-seo && printf '%s\n' mysite.ch rivera-family-plumbing.kleap.io > ~/.kleap-seo/sites.txt

# 4. schedule it every day at 07:07 (isolated session, summary sent to your chat)
openclaw cron add --name "Kleap SEO autopilot" --cron "7 7 * * *" --tz Europe/Paris --session isolated --announce \
  --timeout-seconds 1800 \
  --message "Use the kleap-seo-autopilot skill: run its daily loop once for the sites in ~/.kleap-seo/sites.txt, then give me the owner report. On Mondays also give the weekly summary."
openclaw cron run <job-id>        # run it once now to check (debug)
```
In newer OpenClaw versions `cron` is an alias of `openclaw automations create "<cron>" "<message>" ...`.
`--timeout-seconds` matters: the default job timeout is 30 s, a pass over 10 sites takes minutes.

## Hermes Agent  (syntax from hermes-agent.nousresearch.com docs; Hermes is not installed on our machine, so NOT run by us)

```bash
# 1. skill: Hermes loads Agent Skills from $HERMES_HOME/skills (default ~/.hermes/skills)
mkdir -p ~/.hermes/skills && cp -R kleap-seo-autopilot ~/.hermes/skills/

# 2. the key goes in ~/.hermes/.env (secrets only, never config.yaml)
echo 'KLEAP_API_KEY=kleap_live_sk_...' >> ~/.hermes/.env
mkdir -p ~/.kleap-seo && printf '%s\n' mysite.ch rivera-family-plumbing.kleap.io > ~/.kleap-seo/sites.txt

# 3. schedule it (skill-backed cron job)
hermes cron create "7 7 * * *" "Run the daily loop of the kleap-seo-autopilot skill for the sites in ~/.kleap-seo/sites.txt, then give me the owner report. On Mondays also give the weekly summary." \
  --skill kleap-seo-autopilot --name "Kleap SEO autopilot"
```
Optional MCP route instead of the CLI (Hermes MCP client, `~/.hermes/config.yaml`; the docs say `${VAR}` placeholders in `headers` are resolved from `~/.hermes/.env`):
```yaml
mcp_servers:
  kleap:
    url: "https://kleap.co/api/mcp"
    headers:
      Authorization: "Bearer ${KLEAP_API_KEY}"
```
With the MCP route the agent follows the loop in `SKILL.md` using the tool names in its table (`find_app`, `read_files`, `edit_files`,
`publish_app`, `get_search_console`) and the manual audit checklist in `references/astro-seo-fixes.md`.

## What a good run looks like

One message per run: per site the live URL, each change as `page: before -> after`, what was skipped (and why), what needs you
(for example "Search Console not connected"), and on Mondays a short weekly summary from `seo-log.mjs weekly`.
