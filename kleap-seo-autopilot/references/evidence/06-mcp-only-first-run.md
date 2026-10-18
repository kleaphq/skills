# mcp only first run

- What: No shell, no files: ONLY the Kleap MCP connector (the ChatGPT / Claude.ai case). First run proposes.
- Prompt typed: the pasteable prompt of prompts/claude.md (connector route), site filled in
- Date: 2026-10-18 (the `TODAY` of the day-2/drift runs was set to 2026-10-19 / 2026-10-20 inside the skill scripts to simulate the next days; the sites and the publishes were real)
- Run: wall_clock_s=42  turns=9  cost_usd=0.3850248  tool_calls=8  first_publish_at_s=None (cost_usd = Claude Code API-equivalent of the session; Kleap credits spent by the skill: 0)
- Agent: Claude Code 2.1.300, a NEW session that had only the skill folder installed (or only the Kleap MCP connector for the MCP runs). Test site 116838, seeded by us. Nothing else was explained to it.

## The agent's final answer, verbatim

I've finished the read-only audit of your hotel site. Nothing has been edited or published. This is the first run (there's no memory file yet), so I need your approval before I change anything.

## Hotel Kleap Prod Check
**Live URL:** https://hotel-kleap-prod-check.kleap.io (published, no custom domain)

**Checklist score:** 3 / 7 checks pass on the only page, `src/pages/index.astro`. This is our own checklist, not a Google metric.

| Check | Result |
|---|---|
| Title 30–60 characters | ❌ The title is `"Hotel"` (5 characters) |
| Description 70–160 characters | ❌ The page has no description. The layout fills in a generic one automatically. |
| Exactly one `<h1>` | ✅ |
| Every `<img>` has alt text | ❌ The hero photo (`rooftop-pool-1.jpg`) has no alt text |
| Internal links point to existing pages | ❌ The **Spa** link in the menu goes to `/spa`, and that page doesn't exist |
| Homepage has schema | ✅ (Hotel) |
| About 120+ visible words | ✅ |

## Proposed fixes (3, all in `src/pages/index.astro`, one edit)
1. **Title:** `Hotel` → `Hotel Kleap Prod Check — Deluxe Room & Rooftop Pool` (51 characters)
2. **Description:** (none) → `A small hotel and a little escape: stay in our Deluxe Room, unwind by the Rooftop Pool and send a stay enquiry to plan your visit.` (about 130 characters, using only facts already on the page)
3. **Dead link:** remove `<a href="/spa">Spa</a>` from the menu. The other three menu links stay. The site never mentions a spa anywhere else, so I won't invent a page for it.
   - Alternative: you write a real Spa page and I keep the link. Tell me which you prefer.

The next fix I'd make is giving the hero photo alt text (`Rooftop Pool at Hotel Kleap Prod Check`).

⚠️ **Publishing also ships any other unpublished edit in the site.** There's no snapshot yet, so I can't tell what's already live. `index.astro` was changed today at 17:37 and `global.css` at 16:20. If those changes haven't been published, they will go live with my fixes.

## Skipped
- **Search Console data:** Search Console isn't connected, so I couldn't check for pages that get seen in Google but rarely clicked. You can connect it in Kleap under the site's options → Integrations → Search Console.
- **Header and footer:** they're written inside the homepage itself (there are no separate Header/Footer files), so the audit above covers them.

## What needs you
- **Reply "yes"** to apply fixes 1–3 and publish. Or tell me to keep the Spa link and you'll write that page.
- **Leftover text on the page:** the gallery shows `"Received 4 photos from this folder: deluxe-room-1.jpg, …"` to visitors. It looks like a build artifact. Do you want me to remove it? It counts as removing content, so I'm asking first.
- **Autopilot mode:** say if you want "auto" mode for future runs. Otherwise I'll keep proposing changes and asking first.

## Next
After your yes: I apply the 3 fixes in one edit, publish, check the publish report, and save the memory file with a snapshot of the site files. On the next run: the hero photo's alt text, and Search Console data if it's connected by then.
