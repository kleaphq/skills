#!/usr/bin/env node
// kleap-seo-autopilot / seo-log.mjs — the memory of the autopilot (plain JSON lines, no database).
//
//   node seo-log.mjs add '<json>'        append one entry (adds "ts")
//   node seo-log.mjs budget <site>       fixes already applied today + (page,type) pairs touched in the last 14 days
//   node seo-log.mjs weekly [--days 7]   human summary of the last N days, per site
//
// Entry shape written by the loop (one line per site per run):
//   {"site":"116838","name":"Hotel X","fixes":[{"page":"/","type":"title_short","before":"Hotel","after":"Hotel X — Rooms & Rooftop"}],
//    "published":true,"live_verified":true,"reverted":false,"gsc":{"clicks":12,"impressions":900},"notes":""}
// Log file: $KLEAP_SEO_HOME/log.jsonl (default ~/.kleap-seo/log.jsonl). Zero dependencies, Node >= 18.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME = process.env.KLEAP_SEO_HOME || path.join(os.homedir(), ".kleap-seo");
const FILE = path.join(HOME, "log.jsonl");
fs.mkdirSync(HOME, { recursive: true });

const read = () =>
  fs.existsSync(FILE)
    ? fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } })
    : [];
const [cmd, ...rest] = process.argv.slice(2);
const dayOf = (iso) => iso.slice(0, 10);

if (cmd === "add") {
  const e = JSON.parse(rest[0] || "{}");
  if (!e.site) { console.error("entry needs a \"site\""); process.exit(2); }
  fs.appendFileSync(FILE, JSON.stringify({ ts: new Date().toISOString(), ...e }) + "\n");
  console.log(`logged ${e.site}: ${(e.fixes || []).length} fix(es)${e.reverted ? " (reverted)" : ""} -> ${FILE}`);
} else if (cmd === "budget") {
  const site = rest[0];
  const today = dayOf(new Date().toISOString());
  const since = Date.now() - 14 * 864e5;
  const mine = read().filter((e) => String(e.site) === String(site) && !e.reverted);
  const doneToday = mine.filter((e) => dayOf(e.ts) === today).reduce((n, e) => n + (e.fixes || []).length, 0);
  const recent = [...new Set(mine.filter((e) => Date.parse(e.ts) >= since).flatMap((e) => (e.fixes || []).map((f) => `${f.page}|${f.type}`)))];
  console.log(JSON.stringify({ site, fixes_today: doneToday, remaining_today: Math.max(0, 3 - doneToday), touched_last_14d: recent }));
} else if (cmd === "weekly") {
  const days = Number(rest[rest.indexOf("--days") + 1]) || 7;
  const since = Date.now() - days * 864e5;
  const es = read().filter((e) => Date.parse(e.ts) >= since);
  if (!es.length) { console.log(`No autopilot runs in the last ${days} days.`); process.exit(0); }
  const bySite = {};
  for (const e of es) (bySite[e.site] ||= []).push(e);
  let total = 0, reverted = 0;
  console.log(`SEO autopilot — last ${days} days`);
  for (const [site, list] of Object.entries(bySite)) {
    const fixes = list.filter((e) => !e.reverted).flatMap((e) => e.fixes || []);
    total += fixes.length; reverted += list.filter((e) => e.reverted).length;
    const gsc = list.filter((e) => e.gsc).map((e) => e.gsc);
    const g = gsc.length ? ` | GSC ${gsc[0].clicks ?? "?"} clicks / ${gsc[0].impressions ?? "?"} impr. -> ${gsc.at(-1).clicks ?? "?"} / ${gsc.at(-1).impressions ?? "?"}` : "";
    console.log(`\n${list[0].name || site} (${site}) — ${list.length} run(s), ${fixes.length} fix(es)${g}`);
    for (const f of fixes) console.log(`  - ${f.page} ${f.type}: ${String(f.before ?? "").slice(0, 60)} -> ${String(f.after ?? "").slice(0, 60)}`);
    for (const e of list.filter((x) => x.reverted)) console.log(`  ! reverted on ${dayOf(e.ts)}: ${e.notes || ""}`);
  }
  console.log(`\nTotal: ${total} fix(es) kept, ${reverted} run(s) reverted. Search Console lags 2-3 days: judge impact over 2-4 weeks, not days.`);
} else {
  console.error("usage: seo-log.mjs add '<json>' | budget <site> | weekly [--days N]");
  process.exit(2);
}
