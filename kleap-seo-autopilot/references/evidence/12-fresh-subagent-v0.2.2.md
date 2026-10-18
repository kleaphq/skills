# Version 0.2.2 first run + approval, by a fresh Opus subagent (NOT Claude Code CLI)

- Day: 2026-10-18 (real). The Claude Code CLI session limit of the test machine was exhausted at this point, so this run used an Agent-tool subagent (Opus) that was given only the skill folder path, an env file, and the user's sentence. It is a weaker test than the CLI runs (the skill is not loaded through the skill mechanism; the agent was told where SKILL.md is).
- What it exercised that the earlier runs did not: the 0.2.2 flow (run logged as `pending` BEFORE the publish, `finish` after, JSON on stdin). The resulting log line has `published: true, live_verified: true` and no `pending` key, i.e. it was closed; the live title was verified by curl after the run.
- One imperfection: the logged `score` has `before` but no `after`.
- Not rerun on 0.2.2 (CLI unavailable): the next-day empty-machine run, the undo run and the drift run. Their 0.2.1 transcripts are `evidence/04`-`07`; the code paths they use changed only as described in `proof.md` section 4, and `selftest.mjs` covers the changed paths.

## What it said (SUMMARIES, not verbatim: the subagent transcript was not kept as a file)
Turn 1: listed the 3 fixes before -> after, the unpublished-edits warning, asked "Apply these 3 fixes and publish? (yes / change something / no)". Turn 2: made the 3 changes and published; checklist 50 -> 88; live page verified; the publish report still listed /spa (stale); mobile menu side effect noted; left for next run: hero alt text; needs the owner: leftover gallery text, the "Spa" decision, Search Console needs a custom domain; undo available from any machine. The log line and the live title were checked by us afterwards.
