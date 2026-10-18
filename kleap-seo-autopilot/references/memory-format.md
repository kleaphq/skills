# The memory file: `.kleap/seo-autopilot.json` (one format for the shell scripts AND the MCP connector)

It lives in the site's own source, so a run on any machine, in a container, in a ChatGPT task or a Claude routine starts with the whole history. Visitors get a 404 for it
(`.kleap/` is not part of the published site; checked on 2026-10-18). Safe to delete: the autopilot then starts from zero and asks before publishing again.
Scripts write it with `seo-log.mjs push`, read it with `pull`; an agent with only the connector writes the same JSON with `write_files`. Both must use exactly these fields:

```json
{
  "v": 1,
  "site": "116838",
  "mode": "propose",
  "since": "2026-10-18T12:00:00.000Z",
  "runs": [
    {
      "ts": "2026-10-18T12:05:00.000Z",
      "site": "116838",
      "score": { "before": 50, "after": 88 },
      "edits": [{ "path": "src/pages/index.astro", "find": "title=\"Hotel\"", "replace": "title=\"Hotel Kleap Prod Check — Deluxe Room & Rooftop Pool\"" }],
      "fixes": [
        { "page": "/", "type": "title_short", "before": "Hotel", "after": "Hotel Kleap Prod Check — Deluxe Room & Rooftop Pool",
          "analytics_before": { "views": 40 }, "gsc_before": { "clicks": 3, "impressions": 210, "ctr": 1.4, "position": 14.2, "days": 28 } }
      ],
      "published": true, "live_verified": true, "reverted": false
    }
  ],
  "measures": [
    { "id": "116838|2026-10-18T12:05:00.000Z|/|title_short", "page": "/", "type": "title_short", "override": "kept", "gsc": { "verdict": "improved" } }
  ],
  "snapshot": { "taken_at": "2026-10-18T12:06:00.000Z", "files": { "src/pages/index.astro": "2026-10-18T12:05:30Z" } }
}
```

| Field | Rule |
|---|---|
| `site` | the numeric app id, as a string. A name or address is resolved to it; an unresolvable name stops the run instead of starting a second history |
| `mode` / `since` | `propose` (default: ask before publishing), `auto`, `pause` (do nothing). The newest `since` wins across machines; a pause wins a tie |
| `score` | numbers 0-100 (checks passed / checks total x 100). Never "3/7" |
| `edits` | one `{path, find, replace}` per file edit, the exact strings used. `seo-log.mjs undo` reverses them, newest first, and leaves any text the owner changed |
| `fixes[].page` | the ROUTE (`/`, `/about`), never a file path |
| `fixes[].type` | the audit's finding type: `missing_title`, `title_short`, `title_long`, `missing_description`, `description_short`, `description_long`, `duplicate_title`, `duplicate_description`, `no_h1`, `multiple_h1`, `missing_alt`, `dead_internal_link`, `no_page_schema`, `thin_page`, `orphan_page`, `gsc_low_ctr`, `growth_new_page` |
| `analytics_before` | the page's row of `analytics --period 30d` at fix time. Record it on EVERY fix: it is the only baseline a `*.kleap.io` site has |
| `gsc_before` | the page's row of `search-console --period 28d` at fix time, with `days: 28`. Only with Search Console (custom domain) |
| `snapshot.files` | path -> `updated_at` of every file outside `.kleap/` right after OUR successful publish. A file newer than this is an unpublished edit by someone else (drift) |
| `measures` | written by `seo-log.mjs measure` (or by the connector prompt's step 9): `override` kept/overridden after 3 days, `gsc.verdict` after 28 days |

Up to the last 40 runs and 80 measures are kept. The file holds only what this skill changed (before -> after text), nothing else about your site.
