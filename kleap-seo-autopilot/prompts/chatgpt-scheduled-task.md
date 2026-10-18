# Kleap SEO autopilot in ChatGPT (and any agent that has only the Kleap connector, no shell)

**In 3 steps:** (1) add the connector `https://kleap.co/api/mcp` (below), (2) paste the prompt of Step 1 in a chat and say yes to the first fixes, (3) say "autopilot" and ask for a daily schedule.

## Status, read this first

- **Kleap's official ChatGPT app (plugin) is not published yet.** When it is: Settings -> Apps -> Kleap -> Connect, and nothing below changes.
- **Route that works today: a custom connector** (paid ChatGPT plan: Plus, Pro, Business or Enterprise; custom MCP connectors need Developer mode).
  1. ChatGPT -> Settings -> Apps (Connectors) -> Advanced -> turn on **Developer mode** -> **Create**.
  2. Name `Kleap`, MCP server URL `https://kleap.co/api/mcp`, authentication **OAuth** (ChatGPT discovers it by itself; Kleap supports dynamic client registration).
  3. Sign in to Kleap in the popup, **Approve**. The 34 Kleap tools appear in the connector.
- **What we verified:** the MCP endpoint, OAuth discovery, and the whole loop below through the connector tools alone (a Claude Code session with ONLY the Kleap connector, shell and file tools disabled, ran the first-run proposal and then the approved edit + publish + memory write on a test site: `references/evidence/08-mcp-only-first-run.md` and `09-mcp-only-applied.md`).
  **Not verified by us:** ChatGPT itself executing a custom connector inside a *scheduled* task. OpenAI's docs say scheduled tasks can use plugins and skills; third-party guides report custom MCP connectors work there too.
  Check it once: create the task, press **Run now**, read the result in **Scheduled**. If the connector is not available there, use the Codex route at the end.
- **Why the memory lives in the site:** a scheduled task opens a NEW chat on every run and remembers nothing. So the prompt stores its memory in the site itself (`.kleap/seo-autopilot.json`, never served to visitors, 404 on the live site) and reads it back first. That is also how it learns between runs.

## Step 1: run it once in a normal chat (you approve the first changes)

Paste, fill in your site, and answer when it asks. Say **"autopilot"** when you want it to stop asking.

**Paste the prompt in [`connector-prompt.md`](connector-prompt.md)** (one copy for every agent: fill in your site address, nothing else).

## Step 2: when you trust it, schedule it

In the same chat say **"autopilot"**: it sets `mode` to `auto` in the memory file. Then ask: *"Schedule this every day at 7:07."* (or Scheduled -> New task with the same prompt: the memory says `auto`, so it does not ask).
Each run starts a new chat, reads the memory from the site, and picks up where the last one stopped. Start with 3 sites per run and raise it only if runs finish (ChatGPT limits how long a task may run; we have no number for it).
To stop: tell it "pause SEO autopilot on {site}", or delete the task.

## Route that needs no connector question: Codex scheduled task + the skill

Codex (ChatGPT desktop app / Codex CLI) runs real shell, supports skills and MCP, and has scheduled tasks. This route has the scripts (audit score, drift guard, measurement), so it is the stronger one if you have Codex.
```bash
mkdir -p ~/.agents/skills && cp -R kleap-seo-autopilot ~/.agents/skills/    # Codex user skills folder (or <repo>/.agents/skills)
npx -y kleap-cli@2.1.0 auth login                                           # attended; for a server: export KLEAP_API_KEY=kleap_live_sk_... (Full preset, https://kleap.co/settings/api-key)
```
Run it once yourself ("Use the kleap-seo-autopilot skill on mysite.com"), say **autopilot**, then schedule "Use the kleap-seo-autopilot skill: run its autopilot for the sites in ~/.kleap-seo/sites.txt, then report." from the Scheduled view.
