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
npx skills add kleaphq/skills
```

The `skills` CLI auto-detects your agent and installs all the skills. Alternatives:

```bash
gh skill install kleaphq/skills          # GitHub CLI extension
```

Claude Code marketplace:

```
/plugin marketplace add kleaphq/skills
/plugin install kleap@kleap
```

## Connect Kleap (no API key)

The skills drive the Kleap MCP server. Connect it once, OAuth in the browser, no key to copy:

```bash
claude mcp add --transport http --scope user kleap https://kleap.co/api/mcp
```

Cursor / Windsurf / Cline: add `https://kleap.co/api/mcp` as an HTTP MCP server.
ChatGPT / Claude web: add it as a custom connector. Prefer a local CLI? `npx -y kleap-cli` works too.

## Skills

| Skill | Use it to |
|-------|-----------|
| **kleap-build** | Create a new hosted site from a prompt |
| **kleap-edit**  | Change an existing site (exact files or describe the outcome) |
| **kleap-publish** | Publish with the verified-live guarantee, buy a domain (user-paid checkout) or connect one |
| **kleap-data** | Read form leads, traffic and Search Console; read and change the site's database |
| **kleap-multilingual** | Make an Astro site multilingual (i18n routes, hreflang, language switcher) |
| **kleap-seo-autopilot** | Your agent fixes the 3 biggest SEO problems on your Kleap site, publishes, proves the page is live, remembers and learns. Free read-only audit for any URL, no account (`node kleap-seo-autopilot/scripts/seo-audit.mjs --url https://your-site.com`) |

## The golden rule

A deploy being *started* is not the same as a site being *online*. These skills
only report a site live after Kleap confirms `status: "published"` with a real
`production_url`.

Learn more at [kleap.co/mcp](https://kleap.co/mcp).
