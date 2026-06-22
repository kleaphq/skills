# Kleap Skills

Build, edit and publish **real, hosted websites** with [Kleap](https://kleap.co)
from inside any AI agent — Claude Code, Claude Desktop, Cursor, ChatGPT, Windsurf
or Cline.

Kleap is website infrastructure for agents: you describe a site, Kleap builds it
(hosting + database + auth + SSL), connects a domain, and publishes it with a
**verified-live guarantee** — it only reports success once the site is provably
serving.

## Install

```bash
npx skills add Kleap-co/skills
```

The `skills` CLI auto-detects your agent and installs all three skills. Alternatives:

```bash
gh skill install Kleap-co/skills          # GitHub CLI extension
```

Claude Code marketplace:

```
/plugin marketplace add Kleap-co/skills
/plugin install kleap@kleap
```

## Connect Kleap (no API key)

The skills drive the Kleap MCP server. Connect it once, OAuth in the browser, no key to copy:

```bash
claude mcp add --transport http --scope user kleap https://kleap.co/api/mcp
```

Cursor / Windsurf / Cline: add `https://kleap.co/api/mcp` as an HTTP MCP server.
ChatGPT / Claude web: add it as a custom connector. Prefer a local CLI? `npx kleap` works too.

## Skills

| Skill | Use it to |
|-------|-----------|
| **kleap-build** | Create a new hosted site from a prompt |
| **kleap-edit**  | Change an existing site (exact files or describe the outcome) |
| **kleap-publish** | Publish with the verified-live guarantee + connect a domain |

## The golden rule

A deploy being *started* is not the same as a site being *online*. These skills
only report a site live after Kleap confirms `status: "published"` with a real
`production_url`.

Learn more at [kleap.co/mcp](https://kleap.co/mcp).
