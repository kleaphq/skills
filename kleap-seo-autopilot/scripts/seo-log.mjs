#!/usr/bin/env node
// kleap-seo-autopilot / seo-log.mjs — the memory of the autopilot (plain JSON files, no database, zero dependencies, Node >= 18).
//
// Every run, per site:
//   node seo-log.mjs pull <site>                    FIRST: fetch the site's memory (.kleap/seo-autopilot.json in the site itself) so this machine knows the history
//   node seo-log.mjs brief <site>                   what to know before choosing fixes: first run?, mode, budget, pairs not to touch, lessons, fixes due for measurement
//   node seo-log.mjs drift <site>                   did anyone edit the site since our last publish? (state: none | clean | drift)
//   ... audit, fix, publish ...
//   node seo-log.mjs add '<json>'                   log the run (shape below)
//   node seo-log.mjs snapshot <site>                AFTER a successful publish: remember the file state we shipped (for the next drift check)
//   node seo-log.mjs push <site>                    LAST: save the memory back into the site (not published, 404 to visitors)
// Occasionally:
//   node seo-log.mjs mode <site> [propose|auto|pause]   read / set autonomy (default propose = ask first; pause = do nothing)
//   node seo-log.mjs measure <site> --audit audit.json [--gsc gsc.json] [--analytics an.json] [--min-days 14]
//   node seo-log.mjs lessons                        what the autopilot has learned (also written to lessons.json)
//   node seo-log.mjs weekly [--days 7]              owner-facing summary: shipped, kept, measured, learned
//   (budget <site> = brief <site>, kept for older prompts)
//
// Run entry (one per site per run):
//   {"site":"116838","name":"Hotel X","score":{"before":71,"after":94},
//    "fixes":[{"page":"/","type":"title_short","field":"title","before":"Hotel","after":"Hotel X — Rooms & Rooftop",
//              "gsc_before":{"clicks":3,"impressions":210,"ctr":1.4,"position":14.2},"analytics_before":{"views":40}}],
//    "published":true,"live_verified":true,"reverted":false,"gsc":{"clicks":12,"impressions":900},"notes":""}
//   `gsc_before` = the page's own row from `kleap search-console <site> --json` (top_pages) at fix time; `analytics_before` = the page's row
//   from `kleap analytics <site> --period 30d --json` (top_pages: {path, views}). Both optional; they are what makes learning possible.
//
// Files in $KLEAP_SEO_HOME (default ~/.kleap-seo): log.jsonl, measures.jsonl, lessons.json, config.json, published-state/<site>.json.
// The site's own copy of the memory is .kleap/seo-autopilot.json. Tests can pretend it is another day with KLEAP_SEO_TODAY=YYYY-MM-DD.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME = process.env.KLEAP_SEO_HOME || path.join(os.homedir(), ".kleap-seo");
const F = (n) => path.join(HOME, n);
fs.mkdirSync(HOME, { recursive: true });
fs.mkdirSync(F("published-state"), { recursive: true });

const BIN = (process.env.KLEAP_BIN || "npx -y kleap-cli@2.1.0").split(" ");
function kleap(cliArgs, { allowFail = false } = {}) {
  let last = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return execFileSync(BIN[0], [...BIN.slice(1), ...cliArgs], {
        encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 120000,
        env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || "--dns-result-order=ipv4first" },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      last = String(e.stdout || e.stderr || e.message).slice(0, 400);
      if (/NOT_FOUND|INSUFFICIENT_SCOPE|HTTP 40[134]/.test(last)) break;
    }
  }
  if (allowFail) return null;
  throw new Error(last);
}

const now = () => (process.env.KLEAP_SEO_TODAY ? new Date(process.env.KLEAP_SEO_TODAY + "T12:00:00Z") : new Date());
const dayOf = (iso) => String(iso).slice(0, 10);
const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 864e5);
const jl = (file) =>
  fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } })
    : [];
const readJson = (file, d) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return d; } };
const writeJson = (file, v) => fs.writeFileSync(file, JSON.stringify(v, null, 2) + "\n");
const runs = () => jl(F("log.jsonl"));
const fixId = (e, f) => `${e.site}|${e.ts}|${f.page}|${f.type}`; // the site is part of the id: two sites logged in the same millisecond must not collide
const FIELD_OF = (t) => (/title/.test(t) ? "title" : /description/.test(t) ? "description" : null);
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const MEM_PATH = ".kleap/seo-autopilot.json";
const die = (m, code = 1) => { console.error(m); process.exit(code); };

const [cmd, ...rest] = process.argv.slice(2);
const opt = (n, d) => (rest.includes(n) ? rest[rest.indexOf(n) + 1] : d);
const configOf = () => readJson(F("config.json"), { sites: {} });
// One site = one key, always its numeric app id. An agent may call the same site 116838, hotel-x.kleap.io or hotel-x: three keys would split the
// history (budget, cool-downs, drift, lessons) into three and the skill would forget what it did yesterday. Resolved once, cached in config.json.
function canon(site) {
  if (site == null) return site;
  const s = String(site);
  if (/^\d+$/.test(s)) return s;
  const cfg = configOf();
  if (cfg.aliases?.[s]) return cfg.aliases[s];
  const out = kleap(["status", s, "--json"], { allowFail: true });
  try { const id = JSON.parse(out).id; if (id) { cfg.aliases = { ...(cfg.aliases || {}), [s]: String(id) }; writeJson(F("config.json"), cfg); return String(id); } } catch {}
  return s;
}

// ── lessons ────────────────────────────────────────────────────────────────────────────────────
function rebuildLessons() {
  const ms = jl(F("measures.jsonl"));
  const byType = {};
  for (const m of ms) {
    const t = (byType[m.type] ||= { measured: 0, kept: 0, overridden: 0, improved: 0, flat: 0, worse: 0, too_little_data: 0 });
    t.measured++;
    if (m.override === "kept") t.kept++;
    if (m.override === "overridden") t.overridden++;
    // Google data first, all-source traffic is the weaker fallback. When the owner replaced our wording, the page now runs THEIR text:
    // whatever Google did is not our fix's result, so only the override is counted (it is the lesson), never a good/bad verdict.
    const v = m.override === "overridden" ? null : (m.gsc?.verdict ?? m.traffic?.verdict);
    if (v) t[v]++;
  }
  const rules = { doubleDown: [], testing: [], dropped: [] };
  for (const [type, t] of Object.entries(byType)) {
    if (t.worse >= 2 || t.overridden >= 2) rules.dropped.push(type);
    else if (t.improved >= 2 && t.worse === 0) rules.doubleDown.push(type);
    else rules.testing.push(type);
  }
  // owner style: what the owner wrote when they replaced one of our fixes (the best style guide there is)
  const owner_style = ms.filter((m) => m.override === "overridden" && m.owner_text)
    .slice(-6).map((m) => ({ site: m.site, page: m.page, field: m.field, ours: m.after, owner: m.owner_text }));
  const lessons = { updated: now().toISOString(), byType, rules, owner_style };
  writeJson(F("lessons.json"), lessons);
  return lessons;
}
const lessonsNow = () => readJson(F("lessons.json"), { byType: {}, rules: { doubleDown: [], testing: [], dropped: [] }, owner_style: [] });

// ── site memory (.kleap/seo-autopilot.json) ────────────────────────────────────────────────────
function readSiteMemory(site) {
  const out = kleap(["files", "cat", site, MEM_PATH, "--json"], { allowFail: true });
  if (out === null) return null;
  try { const j = JSON.parse(out); const c = j.files?.[0]?.content; return c ? JSON.parse(c) : null; } catch { return null; }
}
function mergeInto(file, incoming, keyOf) {
  const have = new Set(jl(file).map(keyOf));
  let n = 0;
  for (const x of incoming) if (!have.has(keyOf(x))) { fs.appendFileSync(file, JSON.stringify(x) + "\n"); have.add(keyOf(x)); n++; }
  return n;
}

// Merge the memory saved in the site into the local files (idempotent). The memory belongs to this site, so every entry is stamped with its canonical key.
function pullMemory(site) {
  const mem = readSiteMemory(site);
  if (!mem || !mem.runs) return null;
  const nr = mergeInto(F("log.jsonl"), mem.runs.map((e) => ({ ...e, site })), (e) => `${e.ts}|${e.site}`);
  const nm = mergeInto(F("measures.jsonl"), (mem.measures || []).map((m) => ({ ...m, site })), (m) => m.id);
  const cfg = configOf();
  // the autonomy switch travels with the site: a pause set on another machine must stop THIS machine too. Adopt the remote mode when we have none,
  // when it says pause (the safe direction always wins), or when it was set more recently than ours.
  const loc = cfg.sites[site];
  if (mem.mode && (!loc || mem.mode === "pause" || (mem.since && loc.since && String(mem.since) > String(loc.since)))) { cfg.sites[site] = { mode: mem.mode, since: mem.since || null }; writeJson(F("config.json"), cfg); }
  if (mem.snapshot && !fs.existsSync(F(`published-state/${site}.json`))) writeJson(F(`published-state/${site}.json`), mem.snapshot);
  rebuildLessons();
  return { nr, nm, mode: cfg.sites[site]?.mode || "propose" };
}

function pushMemory(site) {
  pullMemory(site); // never overwrite history another machine saved since our pull
  const cfg = configOf();
  const byTs = (x, y) => String(x.ts).localeCompare(String(y.ts));
  const mem = {
    v: 1, site, updated: now().toISOString(), mode: cfg.sites[site]?.mode || "propose", since: cfg.sites[site]?.since || null,
    note: "Memory of the Kleap SEO autopilot skill for this site. Not published (visitors get a 404). Safe to delete: the autopilot then starts from zero.",
    runs: runs().filter((e) => String(e.site) === String(site)).sort(byTs).slice(-40),
    measures: jl(F("measures.jsonl")).filter((m) => String(m.site) === String(site)).sort(byTs).slice(-80),
    snapshot: readJson(F(`published-state/${site}.json`), null),
  };
  const tmp = path.join(os.tmpdir(), `seo-mem-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify(mem, null, 1) + "\n");
  try { kleap(["files", "write", site, MEM_PATH, "--file", tmp]); } finally { fs.unlinkSync(tmp); }
  return mem;
}

// ── commands ───────────────────────────────────────────────────────────────────────────────────
if (cmd === "add") {
  const e = JSON.parse(rest[0] || "{}");
  if (!e.site) die('entry needs a "site"', 2);
  e.site = canon(e.site);
  for (const f of e.fixes || []) if (!f.field) f.field = FIELD_OF(f.type);
  fs.appendFileSync(F("log.jsonl"), JSON.stringify({ ts: now().toISOString(), ...e }) + "\n");
  console.log(`logged ${e.site}: ${(e.fixes || []).length} fix(es)${e.reverted ? " (reverted)" : ""} -> ${F("log.jsonl")}`);
} else if (cmd === "mode") {
  const site = canon(rest[0]), val = rest[1];
  if (!site) die("usage: seo-log.mjs mode <site> [propose|auto|pause]", 2);
  const cfg = configOf();
  if (val) {
    if (!["propose", "auto", "pause"].includes(val)) die("mode is propose | auto | pause", 2);
    cfg.sites[site] = { mode: val, since: now().toISOString() };
    writeJson(F("config.json"), cfg);
    try { pushMemory(site); } catch { console.error("(could not save the new mode into the site: run `seo-log.mjs push " + site + "` so other machines see it)"); }
  }
  console.log(JSON.stringify({ site, mode: cfg.sites[site]?.mode || "propose", since: cfg.sites[site]?.since || null }));
} else if (cmd === "brief" || cmd === "budget") {
  const site = canon(rest[0]);
  if (!site) die("usage: seo-log.mjs brief <site>", 2);
  const today = dayOf(now().toISOString());
  const t14 = now().getTime() - 14 * 864e5, t30 = now().getTime() - 30 * 864e5;
  const all = runs().filter((e) => String(e.site) === String(site));
  const kept = all.filter((e) => !e.reverted);
  const doneToday = kept.filter((e) => dayOf(e.ts) === today).reduce((n, e) => n + (e.fixes || []).length, 0);
  const touched = [...new Set(kept.filter((e) => Date.parse(e.ts) >= t14).flatMap((e) => (e.fixes || []).map((f) => `${f.page}|${f.type}`)))];
  const reverted = [...new Set(all.filter((e) => e.reverted && Date.parse(e.ts) >= t30).flatMap((e) => (e.fixes || []).map((f) => `${f.page}|${f.type}`)))];
  const measured = new Set(jl(F("measures.jsonl")).map((m) => m.id));
  const due = kept.flatMap((e) => (e.fixes || []).filter((f) => !measured.has(fixId(e, f)) && daysBetween(e.ts, now()) >= 14).map((f) => ({ page: f.page, type: f.type, fixed_on: dayOf(e.ts) })));
  const L = lessonsNow();
  const cfg = configOf();
  const lastScore = [...kept].reverse().find((e) => e.score?.after != null)?.score.after ?? null;
  const mode = cfg.sites[site]?.mode || "propose";
  console.log(JSON.stringify({
    site, first_run: all.length === 0, mode, paused: mode === "pause",
    fixes_today: doneToday, remaining_today: mode === "pause" ? 0 : Math.max(0, 3 - doneToday),
    touched_last_14d: touched, reverted_last_30d: reverted, last_score: lastScore,
    lessons: L.rules, owner_style: L.owner_style, due_for_measure: due,
    hint: due.length ? "run: seo-audit.mjs <site> --json > audit.json; kleap search-console <site> --period 28d --json > gsc.json; kleap analytics <site> --period 30d --json > an.json; seo-log.mjs measure <site> --audit audit.json --gsc gsc.json --analytics an.json" : undefined,
  }));
} else if (cmd === "snapshot") {
  const site = canon(rest[0]);
  if (!site) die("usage: seo-log.mjs snapshot <site>", 2);
  const ls = JSON.parse(kleap(["files", "ls", site, "--json"]));
  const files = Object.fromEntries((ls.files || []).filter((f) => !f.path.startsWith(".kleap/")).map((f) => [f.path, f.updated_at]));
  writeJson(F(`published-state/${site}.json`), { taken_at: now().toISOString(), files });
  console.log(`snapshot of ${Object.keys(files).length} files saved (state after our publish)`);
} else if (cmd === "drift") {
  const site = canon(rest[0]);
  if (!site) die("usage: seo-log.mjs drift <site>", 2);
  const snap = readJson(F(`published-state/${site}.json`), null);
  if (!snap) { console.log(JSON.stringify({ site, state: "none", note: "no snapshot yet: this is the first run, or the memory was not pulled. Ask the owner before the first publish: it ships ALL unpublished edits in the site." })); process.exit(0); }
  const ls = JSON.parse(kleap(["files", "ls", site, "--json"]));
  const cur = Object.fromEntries((ls.files || []).filter((f) => !f.path.startsWith(".kleap/")).map((f) => [f.path, f.updated_at]));
  const changed = Object.keys(cur).filter((p) => !(p in snap.files) || new Date(cur[p]) - new Date(snap.files[p]) > 1000);
  const removed = Object.keys(snap.files).filter((p) => !(p in cur));
  console.log(JSON.stringify({ site, state: changed.length || removed.length ? "drift" : "clean", changed: changed.slice(0, 20), removed: removed.slice(0, 20), since: snap.taken_at,
    note: changed.length || removed.length ? "someone (the owner or Kleap's AI) changed the site after our last publish: do NOT publish; tell the owner, propose only" : "site is exactly as we left it" }));
} else if (cmd === "pull") {
  const site = canon(rest[0]);
  if (!site) die("usage: seo-log.mjs pull <site>", 2);
  const r = pullMemory(site);
  console.log(r ? `memory pulled: ${r.nr} run(s), ${r.nm} measurement(s) added; mode ${r.mode}` : `no memory in the site yet (${MEM_PATH}): first run on this site`);
} else if (cmd === "push") {
  const site = canon(rest[0]);
  if (!site) die("usage: seo-log.mjs push <site>", 2);
  const mem = pushMemory(site);
  console.log(`memory saved to ${MEM_PATH} (${mem.runs.length} run(s), ${mem.measures.length} measurement(s))`);
} else if (cmd === "measure") {
  const site = canon(rest[0]);
  const auditFile = opt("--audit"), gscFile = opt("--gsc"), anFile = opt("--analytics");
  const minDays = Number(opt("--min-days", 14));
  if (!site || !auditFile) die("usage: seo-log.mjs measure <site> --audit audit.json [--gsc gsc.json] [--analytics an.json] [--min-days 14]", 2);
  const audit = readJson(auditFile, null);
  const gsc = gscFile ? readJson(gscFile, null) : null;
  const an = anFile ? readJson(anFile, null) : null;
  if (!audit?.pages) die("audit.json has no pages[]: produce it with seo-audit.mjs <site> --json", 2);
  const pageBy = Object.fromEntries(audit.pages.map((p) => [p.route, p]));
  const gscPages = (gsc?.connected !== false && gsc?.has_data !== false ? gsc?.top_pages : null) || [];
  const gscBy = Object.fromEntries(gscPages.map((p) => { try { return [new URL(p.page, "https://x").pathname.replace(/(.)\/$/, "$1"), p]; } catch { return [p.page, p]; } }));
  const anBy = Object.fromEntries((an?.top_pages || []).map((p) => [p.path, p]));
  const done = new Set(jl(F("measures.jsonl")).map((m) => m.id));
  let n = 0;
  for (const e of runs().filter((x) => String(x.site) === String(site) && !x.reverted)) {
    if (daysBetween(e.ts, now()) < minDays) continue;
    for (const f of e.fixes || []) {
      const id = fixId(e, f);
      if (done.has(id)) continue;
      const m = { id, ts: now().toISOString(), site, page: f.page, type: f.type, field: f.field || FIELD_OF(f.type), fixed_on: dayOf(e.ts), after: f.after };
      const cur = pageBy[f.page]?.[m.field];
      if (m.field && cur != null) {
        if (norm(cur) === norm(f.after)) m.override = "kept";
        else { m.override = "overridden"; m.owner_text = cur; }
      }
      const g = gscBy[f.page];
      if (f.gsc_before && g) {
        const b = f.gsc_before;
        if ((b.impressions ?? 0) < 100) m.gsc = { verdict: "too_little_data", before: b, now: g };
        else {
          const ctrRel = b.ctr ? (g.ctr - b.ctr) / b.ctr : 0;
          const posGain = (b.position ?? 0) - (g.position ?? 0); // positive = moved up
          const clicksRel = b.clicks ? (g.clicks - b.clicks) / b.clicks : 0;
          const verdict = (ctrRel >= 0.2 || posGain >= 1) && clicksRel > -0.2 ? "improved" : (ctrRel <= -0.2 && clicksRel < 0) || posGain <= -2 ? "worse" : "flat";
          m.gsc = { verdict, before: b, now: { clicks: g.clicks, impressions: g.impressions, ctr: g.ctr, position: g.position } };
        }
      }
      const a = anBy[f.page];
      if (!m.gsc && f.analytics_before && a) { // weaker evidence: all-source pageviews, 30-day windows
        const b = f.analytics_before.views ?? 0;
        const rel = b ? (a.views - b) / b : 0;
        m.traffic = { verdict: b < 20 ? "too_little_data" : rel >= 0.25 ? "improved" : rel <= -0.25 ? "worse" : "flat", before_views: b, now_views: a.views, note: "all sources, not only Google" };
      }
      fs.appendFileSync(F("measures.jsonl"), JSON.stringify(m) + "\n");
      n++;
      const sig = (m.gsc ? `Google ${m.gsc.verdict}` : m.traffic ? `traffic ${m.traffic.verdict}` : gscFile || anFile ? "no page data" : "") + (m.override === "overridden" && (m.gsc || m.traffic) ? " (the page runs the owner's wording: not counted for or against this fix type)" : "");
      console.log(`${f.page} ${f.type} (fixed ${m.fixed_on}): ${m.override ? "owner " + m.override : "not checkable"}${sig ? ", " + sig : ""}`);
    }
  }
  const L = rebuildLessons();
  console.log(n ? `${n} fix(es) measured. rules: ${JSON.stringify(L.rules)}` : `Nothing due (needs fixes older than ${minDays} days that were not measured yet).`);
} else if (cmd === "lessons") {
  const L = rebuildLessons();
  if (!Object.keys(L.byType).length) { console.log("No lessons yet: fixes need 14+ days before they can be measured. Run `measure` after that."); process.exit(0); }
  for (const [t, v] of Object.entries(L.byType)) console.log(`${t}: ${v.measured} measured | owner kept ${v.kept}, replaced ${v.overridden} | better ${v.improved}, flat ${v.flat}, worse ${v.worse}, too little data ${v.too_little_data}`);
  console.log(`double down: ${L.rules.doubleDown.join(", ") || "-"} | testing: ${L.rules.testing.join(", ") || "-"} | dropped: ${L.rules.dropped.join(", ") || "-"}`);
  for (const s of L.owner_style) console.log(`owner style (${s.page} ${s.field}): ours "${String(s.ours).slice(0, 60)}" -> theirs "${String(s.owner).slice(0, 60)}"`);
} else if (cmd === "weekly") {
  const days = Number(opt("--days", 7));
  const since = now().getTime() - days * 864e5;
  const es = runs().filter((e) => Date.parse(e.ts) >= since);
  if (!es.length) { console.log(`No autopilot runs in the last ${days} days.`); process.exit(0); }
  const bySite = {};
  for (const e of es) (bySite[e.site] ||= []).push(e);
  let total = 0, reverted = 0;
  console.log(`SEO autopilot — last ${days} days`);
  for (const [site, list] of Object.entries(bySite)) {
    const fixes = list.filter((e) => !e.reverted).flatMap((e) => e.fixes || []);
    total += fixes.length; reverted += list.filter((e) => e.reverted).length;
    const gsc = list.filter((e) => e.gsc).map((e) => e.gsc);
    const g = gsc.length ? ` | Google ${gsc[0].clicks ?? "?"} clicks / ${gsc[0].impressions ?? "?"} impr. -> ${gsc.at(-1).clicks ?? "?"} / ${gsc.at(-1).impressions ?? "?"}` : "";
    const sc = list.filter((e) => e.score);
    const s = sc.length ? ` | checklist ${sc[0].score.before ?? "?"} -> ${sc.at(-1).score.after ?? "?"}/100` : "";
    console.log(`\n${list[0].name || site} (${site}) — ${list.length} run(s), ${fixes.length} fix(es)${s}${g}`);
    for (const f of fixes) console.log(`  - ${f.page} ${f.type}: ${String(f.before ?? "").slice(0, 60)} -> ${String(f.after ?? "").slice(0, 60)}`);
    for (const e of list.filter((x) => x.reverted)) console.log(`  ! reverted on ${dayOf(e.ts)}: ${e.notes || ""}`);
  }
  const ms = jl(F("measures.jsonl")).filter((m) => Date.parse(m.ts) >= since);
  if (ms.length) {
    console.log("\nMeasured this week (fixes that are 14+ days old):");
    for (const m of ms) console.log(`  - ${m.site} ${m.page} ${m.type}: ${m.override ? "owner " + m.override : "n/a"}${m.gsc ? ", Google " + m.gsc.verdict : m.traffic ? ", traffic " + m.traffic.verdict : ""}`);
  }
  const L = lessonsNow();
  if (L.rules.doubleDown.length || L.rules.dropped.length) console.log(`\nLearned so far — double down: ${L.rules.doubleDown.join(", ") || "-"}; stop doing: ${L.rules.dropped.join(", ") || "-"}.`);
  console.log(`\nTotal: ${total} fix(es) kept, ${reverted} run(s) reverted. Google data lags 2-3 days and a title change needs 2-4 weeks to show: judge over weeks, and under 100 clicks in 28 days say "too little data".`);
} else {
  die("usage: seo-log.mjs pull|brief|drift|add|snapshot|push|mode|measure|lessons|weekly  (see the header of this file)", 2);
}
