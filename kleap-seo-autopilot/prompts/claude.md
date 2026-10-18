# Kleap SEO autopilot on Claude (Claude Code, Claude Desktop / claude.ai)

Three ways, from most to least hands-off. What we ran ourselves is marked **(run)**; the rest follows Anthropic's docs.

## A. Claude Code on your machine or a server (skill + CLI) — recommended, it has the scripts

```bash
# 1. install the skill (any one of these)
npx skills add kleaphq/skills --skill kleap-seo-autopilot -g -a claude-code     # user-level (~/.claude/skills); drop -g for this project only. Works once kleaphq/skills has this version
#   or, in Claude Code:  /plugin marketplace add kleaphq/skills   then   /plugin install kleap@kleap   (installs all 6 Kleap skills; this one is /kleap:kleap-seo-autopilot)
#   or copy the folder:  mkdir -p ~/.claude/skills && cp -R kleap-seo-autopilot ~/.claude/skills/

# 2. check the machine and connect Kleap (once). Attended: browser OAuth, nothing to paste.
node ~/.claude/skills/kleap-seo-autopilot/scripts/seo-doctor.mjs my-site.kleap.io     # prints ✓/✗ and the ONE next step
npx -y kleap-cli@2.1.0 auth login                                                    # opens the browser; unattended server: export KLEAP_API_KEY=kleap_live_sk_... (Full preset)

# 3. first run, by hand, so you see and approve the first changes (run: a fresh session did this on a test site)
claude
> Use the kleap-seo-autopilot skill on my-site.kleap.io.      # it shows the 3 fixes as before -> after and asks once
> yes                                                         # it applies, publishes, checks the live page, reports
> autopilot                                                   # optional: from now on it applies without asking

# 4. every day at 07:07, headless. This prints the exact line for THIS machine (absolute paths + PATH, the key in a mode-600 file, the report in a dated file):
printf '%s\n' my-site.kleap.io rivera-family-plumbing.kleap.io > ~/.kleap-seo/sites.txt
node ~/.claude/skills/kleap-seo-autopilot/scripts/seo-schedule.mjs claude            # add --launchd on a Mac for a launchd plist instead of cron
```
Why a script and not a one-liner: cron starts with an almost empty PATH, so a bare `claude`, `node` or `npx` fails silently into a log nobody opens, and a key typed into the crontab line
sits in plain text. The printed line fixes both and writes each run's report to `~/.kleap-seo/reports/<date>.md`.
The printed line limits Claude to `node`, the pinned Kleap CLI, `curl` and a few read-only shell words. Be honest about what that allows: `node` can run any script and a Full key reaches the account's leads and database, so use a key that belongs to the one account whose sites it may edit, nothing else.
A site that is still in `propose` mode is audited and the plan goes in the report, nothing is applied: that is the safe default until you say *autopilot*.
The memory lives in the site (`.kleap/seo-autopilot.json`), so the schedule can run on any machine, in a container, or in CI.

## B. Claude Code Routine (runs in Anthropic's cloud, laptop closed)

Routines are in research preview, on Pro / Max / Team / Enterprise, minimum interval 1 hour, and they use the
connectors of your claude.ai account (a server added with `claude mcp add` is NOT visible to a routine).
1. claude.ai -> Customize -> Connectors -> **Add custom connector** -> `https://kleap.co/api/mcp` -> Connect -> sign in to Kleap -> Approve.
   (The Claude-directory version of the connector, `https://kleap.co/api/mcp/claude`, has 29 tools instead of 34; the five it leaves
   out are `generate_image`, `buy_domain`, `upgrade_plan`, `run_database_sql`, `wake_app`. The SEO loop uses none of them.)
2. Run the prompt below once in a chat to approve the first changes and say *autopilot*. Then in Claude Code run `/schedule`, or create the routine at
   claude.ai/code/routines: trigger **Schedule -> Daily at 07:07** (avoid exact :00, runs can start minutes late), keep only the Kleap connector, paste the prompt.
The routine cannot run the npm CLI against kleap.co unless you widen its network access, so it uses the connector tools (the prompt below). Its memory is the file in your site, which is what lets a fresh cloud session continue.

## C. Claude Desktop / claude.ai chat, on demand

Add the same custom connector (step B1), then paste the prompt below in a chat whenever you want a pass.

## Prompt for the connector route (B and C)

**Paste the prompt in [`connector-prompt.md`](connector-prompt.md)** (one copy for every agent: fill in your site address, nothing else).
