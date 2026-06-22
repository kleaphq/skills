---
version: 0.1.0
name: kleap-build
description: >-
  Create a real, hosted website with Kleap from a description. Kleap builds it
  (hosting, database, auth and SSL included) and you publish it to a live URL
  with a verified-live guarantee. Use when the user wants to "build a website",
  "make me a site / landing page / portfolio / shop", "create a web app", or
  "put it online" — and actually host it, not just generate code. Requires the
  Kleap MCP server connected (see Setup).
---

# Build a website with Kleap

Kleap is website infrastructure for agents: you describe a site, Kleap builds
and hosts it (hosting + database + auth + SSL), and publishes it with a
**verified-live guarantee**. You drive it through the Kleap MCP tools.

## Setup (once)

Connect the Kleap MCP server — no API key needed:

```
claude mcp add --transport http --scope user kleap https://kleap.co/api/mcp
```

A browser opens once to authorize. (Cursor / Windsurf / Cline: add the same URL
to `mcp.json` as an `"url"` HTTP server. ChatGPT / Claude web: add it as a
custom connector.)

## The golden rule — never claim a site is live until Kleap confirms it

A deploy being *started* is NOT the same as a site being *online*. Only say a
site is live after `get_publish_status` (or `check_task`) returns
`status: "published"` with a `production_url`. If it isn't confirmed, say so
plainly — never invent a working URL.

## Core flow

1. `create_app({ prompt })` — give a detailed description (purpose, pages,
   sections, tone, brand colours, real copy if you have it). Returns
   `{ app_id, task_id }`.
2. `check_task({ task_id })` — poll until `status` is `completed` or `failed`.
   It long-polls, so you don't have to babysit it; builds take a couple of
   minutes (up to ~15 for big sites).
3. If `failed` (transient stalls happen): `retry_task({ task_id })` with the
   SAME task_id — it resumes from partial state and keeps files already written.
   Do NOT start a fresh `create_app`. Poll `check_task` on the new task_id.
   Retry once or twice before giving up.
4. `publish_app({ app_id })` then poll `get_publish_status({ app_id })` until
   `status: "published"`. Report the `production_url` only then.

## Writing a great prompt

- Be concrete: list the pages and the sections each page needs.
- Give the real business name, offer, and contact details — not placeholders.
- State the visual direction (e.g. "warm, editorial, cream + charcoal") and any
  brand colours.
- Mention the goal (sell, book, collect leads) so the CTA fits.

## After it's live

- Connect a domain the user owns with the **kleap-publish** skill.
- Make changes with the **kleap-edit** skill (precise edits via `write_files`,
  or describe the change with `modify_app`).

Builds and edits use Kleap credits; `write_files` and `publish_app` use none.
