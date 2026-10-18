# Kleap SEO autopilot on OpenClaw and Hermes Agent

Both agents have a shell, load Agent Skills (`SKILL.md`) and have a built-in scheduler, so they use the skill + CLI route (no MCP needed).
The skill keeps its memory in the site itself (`.kleap/seo-autopilot.json`), so a scheduled run on a fresh container still knows what happened before.

## OpenClaw  (commands checked against OpenClaw 2026.4.15 `--help` and docs.openclaw.ai)

```bash
# 1. install the skill
openclaw skills install kleap-seo-autopilot                 # the ClawHub slug; works once the listing is published (it is not yet)
#    OpenClaw 2026.4.15 installs ClawHub slugs only (`skills install ./folder` answers "Invalid skill slug"), so until then copy the folder:
mkdir -p ~/.openclaw/skills && cp -R kleap-seo-autopilot ~/.openclaw/skills/        # shared by all local agents; or <workspace>/skills/
openclaw skills list --eligible                             # kleap-seo-autopilot must appear (needs node + npx)

# 2. connect Kleap. Attended: npx -y kleap-cli@2.1.0 auth login (browser, nothing to paste).
#    Unattended: a Full-preset key from https://kleap.co/settings/api-key, in ~/.openclaw/openclaw.json:
#    skills: { entries: { "kleap-seo-autopilot": { apiKey: "kleap_live_sk_..." } } }     (primaryEnv = KLEAP_API_KEY)
#    or export KLEAP_API_KEY in the gateway's environment. Then check everything:
node ~/.openclaw/skills/kleap-seo-autopilot/scripts/seo-doctor.mjs my-site.kleap.io     # ✓/✗ checklist + the ONE next step

# 3. first run by hand, so you approve the first changes
#    tell your agent:  "Use the kleap-seo-autopilot skill on my-site.kleap.io."   -> it shows the plan, you say yes, then "autopilot"

# 4. the sites, then schedule it every day at 07:07 (isolated session, summary sent to your chat)
mkdir -p ~/.kleap-seo && printf '%s\n' my-site.kleap.io rivera-family-plumbing.kleap.io > ~/.kleap-seo/sites.txt
openclaw cron add --name "Kleap SEO autopilot" --cron "7 7 * * *" --tz Europe/Paris --session isolated --announce \
  --timeout-seconds 1800 \
  --message "Use the kleap-seo-autopilot skill: run its autopilot for the sites in ~/.kleap-seo/sites.txt, then give me the owner report. On Mondays also give the weekly report and one growth idea."
openclaw cron run <job-id>        # run it once now to check (debug)
```
In newer OpenClaw versions `cron` is an alias of `openclaw automations create "<cron>" "<message>" ...`.
`--timeout-seconds` matters: the default job timeout is 30 s, a pass over 10 sites takes minutes.

## Hermes Agent  (syntax from hermes-agent.nousresearch.com docs; Hermes is not installed on our machine, so NOT run by us)

```bash
# 1. skill: Hermes loads Agent Skills from $HERMES_HOME/skills (default ~/.hermes/skills)
mkdir -p ~/.hermes/skills && cp -R kleap-seo-autopilot ~/.hermes/skills/

# 2. the key goes in ~/.hermes/.env (secrets only, never config.yaml); check with the doctor
echo 'KLEAP_API_KEY=kleap_live_sk_...' >> ~/.hermes/.env
node ~/.hermes/skills/kleap-seo-autopilot/scripts/seo-doctor.mjs my-site.kleap.io
mkdir -p ~/.kleap-seo && printf '%s\n' my-site.kleap.io rivera-family-plumbing.kleap.io > ~/.kleap-seo/sites.txt

# 3. first run by hand ("Use the kleap-seo-autopilot skill on my-site.kleap.io", approve, say "autopilot"), then schedule it (skill-backed cron job)
hermes cron create "7 7 * * *" "Run the autopilot of the kleap-seo-autopilot skill for the sites in ~/.kleap-seo/sites.txt, then give me the owner report. On Mondays also give the weekly report and one growth idea." \
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
With the MCP route the agent has no scripts: use the prompt in `chatgpt-scheduled-task.md` (Step 1), it carries the whole loop and the list of forbidden tools.

## What a good run looks like

One message per run: per site the live URL, the checklist score before -> after, each change as `page: before -> after`, what was skipped (and why), what needs you
(for example "Search Console not connected, it needs a custom domain"), what it will look at next, and on Mondays the weekly report plus one growth idea for you to approve.
