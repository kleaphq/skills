---
version: 0.2.0
name: kleap-data
description: >-
  Read and manage the data behind a live Kleap site: the leads / contact-form
  submissions it collected, its visitors and Google Search numbers, and the
  rows of its own Postgres database (schema, read, insert, update, delete,
  SQL). Use when the user asks "who contacted me", "export my leads", "how
  many visitors", "add/update/delete a record", "what's in my database", or
  wants to run a query on a site made on Kleap. Requires the Kleap MCP server
  connected.
---

# Leads, traffic and database of a Kleap site

Find the app first: `find_app({ query })` when the user names a domain / URL /
slug, else `list_apps`. Every tool below takes that `app_id`.

## Leads (form submissions)

`get_form_submissions({ app_id, limit?, since? })` → `{ submissions: [{ id,
submitted_at, data: { name, email, … } }] }`, **newest first**, 100 max per
call, no cursor.

- Only new ones: pass `since` = the newest `submitted_at` already handled (ISO
  8601, inclusive — skip `id`s you already saw).
- An empty list on a new site is normal — say "no submissions yet", don't
  suggest the form is broken unless the user reports it.
- Submissions are visitor PII: show what the user asked for, don't paste them
  elsewhere.
- No form on the site yet? `modify_app({ app_id, message: "add a contact form
  with name, email and message" })` wires one that stores submissions here.

## Traffic and search

- `get_analytics({ app_id, period: "7d" | "30d" | "90d" })` — visitors,
  pageviews, top pages, referrers. `configured: false` = never published yet.
- `get_search_console({ app_id })` — Google clicks, impressions, CTR, position,
  top queries (lags ~2 days: the newest days are always incomplete, don't call
  it a drop). Not connected → `connect_search_console({ app_id })` returns a
  `consent_url` the **user** must open in a browser; it needs a connected
  custom domain first (`requires_custom_domain: true`).

## Database (the app's Postgres)

1. `get_database_schema({ app_id })` — tables, `row_count`, columns
   (`name, type, nullable, default, primary_key`). Always start here: never
   guess table or column names.
2. Read: `query_database_rows({ app_id, table, where?, limit?, offset?,
   order_by?, order? })` — `where` is an equality object
   (`{ "status": "new" }`), `limit` ≤ 500; page with `offset` while `has_more`.
3. Write:
   - `insert_database_rows({ app_id, table, rows: [ {…}, … ] })` — ≤ 500 per call; returns the inserted rows.
   - `update_database_rows({ app_id, table, where, set })` — `where` is
     **required and non-empty**.
   - `delete_database_rows({ app_id, table, where })` — `where` required;
     irreversible: read the matching rows first and confirm with the user when
     more than a handful would go.
4. Anything else (ranges, joins, aggregates, DDL):
   `run_database_sql({ app_id, sql, params? })` with `$1..$n` placeholders —
   never paste user values into the SQL string. A single SELECT only needs
   read access.

Data changes are live immediately — no `publish_app` needed (publishing is for
files).

## Errors

| Code | Do this |
|---|---|
| `409 DATABASE_NOT_PROVISIONED` | The app has no database: `modify_app({ app_id, message: "add a database" })`, wait for the task, then retry. |
| `422 RLS_REQUIRED` | The SQL created a public table without row level security: re-run with `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;` (+ policies). For tables the site's pages use, prefer `modify_app` — it writes schema, policies and pages together. |
| `403 INSUFFICIENT_SCOPE` | The connection/key predates this feature (`details.required_scope`). API key: create a new one with the **Full** preset. OAuth connector: disconnect and reconnect Kleap. Retrying unchanged never works. |
| `400 VALIDATION_ERROR` | Fix the input (unknown column, empty `where`, bad JSON). |
| `429 RATE_LIMITED` | Wait a minute, retry once. |
