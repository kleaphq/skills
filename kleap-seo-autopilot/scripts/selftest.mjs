#!/usr/bin/env node
// kleap-seo-autopilot / selftest.mjs — offline check of the memory and learning logic. No network, no Kleap account, no site touched.
//
//   node selftest.mjs        prints one line per check; exit 0 = all pass
//
// It runs seo-log.mjs against a throwaway folder with SYNTHETIC Search Console numbers, so it proves the mechanics (budget, cool-downs, measure,
// keep/override detection, lessons, pause) and says nothing about real SEO outcomes. Real outcomes need weeks of real data (references/proof.md).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "seo-selftest-"));
const run = (day, ...args) => execFileSync("node", [path.join(HERE, "seo-log.mjs"), ...args], {
  encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, KLEAP_SEO_HOME: HOME, KLEAP_BIN: "false", KLEAP_SEO_TODAY: day },
});
let failed = 0;
const check = (name, ok, extra = "") => { if (!ok) failed++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : "  " + extra}`); };
const json = (s) => JSON.parse(s);

const fix = (page, type, before, after, gsc) => ({ page, type, before, after, gsc_before: gsc });
const entry = (site, fixes, extra = {}) => JSON.stringify({ site, name: site, score: { before: 50, after: 80 }, fixes, published: true, live_verified: true, reverted: false, ...extra });
const G = (clicks, impressions, ctr, position) => ({ clicks, impressions, ctr, position });

// day 0: two sites, same millisecond (their fix ids must not collide)
check("first run is detected", json(run("2026-09-01", "brief", "A")).first_run === true);
run("2026-09-01", "add", entry("A", [fix("/", "title_short", "Cafe", "Cafe A - Coffee in Lyon", G(4, 300, 1.3, 14)), fix("/menu", "description_short", "m", "Our full menu and prices", G(2, 150, 1.3, 16))]));
run("2026-09-01", "add", entry("B", [fix("/", "title_short", "Home", "Rivera Plumbing - Emergency Repairs", G(10, 500, 2, 9))]));
const b2 = json(run("2026-09-03", "brief", "A"));
check("fixes are on cool-down for 14 days", b2.touched_last_14d.includes("/|title_short") && b2.touched_last_14d.includes("/menu|description_short"));
check("daily budget counts today's fixes", json(run("2026-09-01", "brief", "A")).remaining_today === 1);
check("nothing is due before 14 days", b2.due_for_measure.length === 0);
const b3 = json(run("2026-09-17", "brief", "A"));
check("fixes become due after 14 days", b3.due_for_measure.length === 2 && b3.touched_last_14d.length === 0);

// day 16: measure. A kept its title and Google moved up; the owner replaced the menu description.
const tmp = (n, v) => { const f = path.join(HOME, n); fs.writeFileSync(f, JSON.stringify(v)); return f; };
const auditA = tmp("a.json", { pages: [{ route: "/", title: "Cafe A - Coffee in Lyon", description: "x" }, { route: "/menu", title: "Menu", description: "Menu of Cafe A: coffee and cakes" }] });
const gscA = tmp("ga.json", { connected: true, has_data: true, top_pages: [{ page: "https://a.example/", clicks: 9, impressions: 330, ctr: 2.7, position: 11.5 }, { page: "https://a.example/menu", clicks: 1, impressions: 140, ctr: 0.7, position: 17 }] });
const m = run("2026-09-17", "measure", "A", "--audit", auditA, "--gsc", gscA);
check("kept + improved is recognised", /\/ title_short .*owner kept, Google improved/.test(m), m);
check("an owner override is recognised and not counted against us", /description_short .*owner overridden/.test(m) && /not counted/.test(m), m);
const auditB = tmp("b.json", { pages: [{ route: "/", title: "Rivera Plumbing - Emergency Repairs", description: "x" }] });
const gscB = tmp("gb.json", { connected: true, has_data: true, top_pages: [{ page: "https://b.example/", clicks: 15, impressions: 520, ctr: 2.9, position: 8.1 }] });
run("2026-09-17", "measure", "B", "--audit", auditB, "--gsc", gscB);
const L = json(run("2026-09-17", "brief", "A")).lessons;
check("two improvements and no loss -> double down", L.doubleDown.includes("title_short"), JSON.stringify(L));
check("an overridden fix is not counted as good or bad", !L.dropped.includes("description_short"), JSON.stringify(L));
const style = json(run("2026-09-17", "brief", "A")).owner_style;
check("the owner's wording becomes the style guide", style.length === 1 && /coffee and cakes/.test(style[0].owner));

// thin data is never judged
run("2026-09-20", "add", entry("C", [fix("/", "title_short", "x", "A better title for site C", G(0, 12, 0, 40))]));
const auditC = tmp("c.json", { pages: [{ route: "/", title: "A better title for site C", description: "x" }] });
const gscC = tmp("gc.json", { connected: true, has_data: true, top_pages: [{ page: "https://c.example/", clicks: 0, impressions: 15, ctr: 0, position: 38 }] });
check("under 100 impressions = too little data", /too_little_data|owner kept$/.test(run("2026-10-10", "measure", "C", "--audit", auditC, "--gsc", gscC)) && json(run("2026-10-10", "brief", "C")).lessons.dropped.length === 0);

// pause is respected
run("2026-10-11", "mode", "A", "pause");
const p = json(run("2026-10-11", "brief", "A"));
check("pause means zero fixes left today", p.paused === true && p.remaining_today === 0);
check("weekly report runs", /Total: \d+ fix/.test(run("2026-10-11", "weekly", "--days", "60")));

console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed (synthetic data: this tests the mechanics, not SEO results)");
fs.rmSync(HOME, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
