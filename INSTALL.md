# Install Kleap Skills

Three skills — `kleap-build`, `kleap-edit`, `kleap-publish` — for building, editing
and publishing real hosted websites with Kleap from any agent.

## Option 1 — `npx skills` (recommended, cross-agent)

```bash
npx skills add kleaphq/skills
```

Installs all three skills. The `skills` CLI auto-detects the host agent (Claude
Code, Cursor, Codex, …) and writes each skill to the right path.

## Option 2 — `gh skill install`

GitHub CLI v2.90+ extension.

```bash
gh skill install kleaphq/skills
```

## Option 3 — Claude Code marketplace

```
/plugin marketplace add kleaphq/skills
/plugin install kleap@kleap
```

## Then connect Kleap (no API key)

The skills call the Kleap MCP server. Connect it once — OAuth in the browser, no key:

```bash
claude mcp add --transport http --scope user kleap https://kleap.co/api/mcp
```

- **Cursor / Windsurf / Cline:** add `https://kleap.co/api/mcp` as an HTTP MCP server in your `mcp.json`.
- **ChatGPT / Claude web:** add `https://kleap.co/api/mcp` as a custom connector.
- **Local CLI:** `npx @eliottd/kleap` (run `npx @eliottd/kleap auth login` to sign in without a key).

Verify with `claude mcp list` or the `/mcp` command, then ask your agent to build a site.
