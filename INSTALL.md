# Install Kleap Skills

Six skills — `kleap-build`, `kleap-edit`, `kleap-publish`, `kleap-data`, `kleap-multilingual`, `kleap-seo-autopilot` — for building, editing,
publishing and SEO-maintaining real hosted websites with Kleap from any agent.

## Option 1 — `npx skills` (recommended, cross-agent)

```bash
npx skills add kleaphq/skills
```

Installs all the skills (one only: `npx skills add kleaphq/skills --skill kleap-seo-autopilot`). The `skills` CLI auto-detects the host agent (Claude
Code, Cursor, Codex, …) and writes each skill to the right path.

## Option 2 — `gh skill install`

GitHub CLI v2.90+ extension.

```bash
gh skill install kleaphq/skills
```

## Option 3 — Claude Code marketplace

```
/plugin marketplace add kleaphq/skills
/plugin install kleap@kleap-skills
```

## Connect Kleap (no API key)

The Claude Code marketplace plugin includes the Kleap MCP connector, so no separate `claude mcp add` command is needed after installing the plugin. If you installed the skills with `npx skills` or `gh skill install`, add the connector to Claude Code manually — OAuth opens in the browser, with no key to copy:

```bash
claude mcp add --transport http --scope user kleap https://kleap.co/api/mcp
```

- **Cursor / Windsurf / Cline:** add `https://kleap.co/api/mcp` as an HTTP MCP server in your `mcp.json`.
- **ChatGPT / Claude web:** add `https://kleap.co/api/mcp` as a custom connector.
- **Local CLI:** `npx -y kleap-cli` (run `npx -y kleap-cli auth login` to sign in without a key).

Verify with `claude mcp list` or the `/mcp` command, then ask your agent to build a site.
