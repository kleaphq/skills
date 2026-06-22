---
version: 0.1.0
name: kleap-edit
description: >-
  Change a website already made on Kleap — fix copy, swap images, edit a shared
  header/footer, add a page or section, correct a wrong number or a dead link.
  Two modes: push exact file contents with your OWN model (deterministic, no
  Kleap credits) or describe the outcome and let Kleap's AI do it. Use when the
  user wants to edit / update / fix an existing Kleap site. Requires the Kleap
  MCP server connected.
---

# Edit a Kleap site

## 1. Find the app

If the user names it by address ("serrureriesk.ch", "mysite.kleap.io"), call
`find_app({ query })` first to resolve it to an `app_id`. If it returns
NOT_FOUND, the site isn't on this account — ask the user or `list_apps`.

## 2. Choose the mode

**Mode A — `write_files` (precise, deterministic, 0 credits) — prefer this for
exact, verifiable edits.** Your model writes the exact file contents and pushes
them; Kleap stores, builds and deploys them as-is. Never stalls.

Never rewrite a file blind:

1. `list_app_files({ app_id })` — see the structure. These are Astro sites:
   `src/pages/*.astro`, `src/components/*.astro` (shared header/footer),
   `src/data/*.json`, `public/*`.
2. `read_files({ app_id, paths })` — get the CURRENT contents (works with a
   read-only key).
3. Edit only what must change.
4. `write_files({ app_id, files: [{ path, content }] })`.
5. `publish_app` (see the **kleap-publish** skill).

This is the reliable way to fix shared components, headers/footers, wrong
numbers, broken links and dead forms.

**Mode B — `modify_app` (Kleap's AI writes the files).** Describe the OUTCOME:
`modify_app({ app_id, message: "Change the headline to X and make the hero
charcoal" })`. Returns a `task_id` — poll `check_task` until `completed`, then
publish. Best when you want Kleap's AI to design the change rather than spell out
the code.

## 3. Publish the change

A change isn't live until you publish AND Kleap confirms it. After
`write_files`, call `publish_app`; after a `modify_app` task completes, publish
too. Then verify with `get_publish_status` (see **kleap-publish**). Never claim
the edit is live until it's confirmed.

## Common edits

- Wrong phone/price/address → read the page or shared data file, fix the value,
  write, publish.
- Broken images → replace the `src` with a real, reachable URL (don't invent
  image URLs — they 404). Use the user's own uploaded assets or a real stock URL.
- Dead form / link → read the component, fix the target, write, publish.
- New page → write `src/pages/<slug>.astro`, link it from the nav component.
