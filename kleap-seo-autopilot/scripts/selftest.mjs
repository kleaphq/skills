#!/usr/bin/env node
// kleap-seo-autopilot / selftest.mjs — offline check of the memory and learning logic. No network, no Kleap account, no site touched.
//
//   node selftest.mjs        prints one line per check; exit 0 = all pass
//
// It runs seo-log.mjs against a throwaway folder with SYNTHETIC Search Console numbers, so it proves the mechanics (budget, cool-downs, measure,
// keep/override detection, lessons, pause) and says nothing about real SEO outcomes. Real outcomes need weeks of real data (references/proof.md).
// Part 2 uses a fake Kleap CLI (a script that keeps one site in a JSON file) to test site-facing logic: one history per site, memory sync, pause across machines,
// drift and its unblock paths, undo.
import { execFileSync, execFile } from "node:child_process";
import http from "node:http";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "seo-selftest-"));
const run = (day, ...args) => execFileSync("node", [path.join(HERE, "seo-log.mjs"), ...args], {
  encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, KLEAP_SEO_HOME: HOME, KLEAP_BIN: "false", KLEAP_SEO_OFFLINE: "1", KLEAP_SEO_TODAY: day },
});
const runIn = (day, input, ...args) => execFileSync("node", [path.join(HERE, "seo-log.mjs"), ...args], {
  encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, KLEAP_SEO_HOME: HOME, KLEAP_BIN: "false", KLEAP_SEO_OFFLINE: "1", KLEAP_SEO_TODAY: day },
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

// day 30: measure (the Google window must start after the fix, so a 28-day window needs a fix that is 28+ days old). A kept its title and Google moved up; the owner replaced the menu description.
const tmp = (n, v) => { const f = path.join(HOME, n); fs.writeFileSync(f, JSON.stringify(v)); return f; };
const auditA = tmp("a.json", { pages: [{ route: "/", title: "Cafe A - Coffee in Lyon", description: "x" }, { route: "/menu", title: "Menu", description: "Menu of Cafe A: coffee and cakes" }] });
const gscA = tmp("ga.json", { connected: true, has_data: true, top_pages: [{ page: "https://a.example/", clicks: 9, impressions: 330, ctr: 2.7, position: 11.5 }, { page: "https://a.example/menu", clicks: 1, impressions: 140, ctr: 0.7, position: 17 }] });
const m = run("2026-10-01", "measure", "A", "--audit", auditA, "--gsc", gscA);
check("kept + improved is recognised", /\/ title_short .*owner kept, Google improved/.test(m), m);
check("an owner override is recognised and not counted against us", /description_short .*owner overridden/.test(m) && /not counted/.test(m), m);
const auditB = tmp("b.json", { pages: [{ route: "/", title: "Rivera Plumbing - Emergency Repairs", description: "x" }] });
const gscB = tmp("gb.json", { connected: true, has_data: true, top_pages: [{ page: "https://b.example/", clicks: 15, impressions: 520, ctr: 2.9, position: 8.1 }] });
run("2026-10-01", "measure", "B", "--audit", auditB, "--gsc", gscB);
const L = json(run("2026-10-01", "brief", "A")).lessons;
check("two improvements and no loss -> double down", L.doubleDown.includes("title_short"), JSON.stringify(L));
check("an overridden fix is not counted as good or bad", !L.dropped.includes("description_short"), JSON.stringify(L));
const style = json(run("2026-10-01", "brief", "A")).owner_style;
check("the owner's wording becomes the style guide", style.length === 1 && /coffee and cakes/.test(style[0].owner));

// thin data is never judged
run("2026-09-20", "add", entry("C", [fix("/", "title_short", "x", "A better title for site C", G(0, 12, 0, 40))]));
const auditC = tmp("c.json", { pages: [{ route: "/", title: "A better title for site C", description: "x" }] });
const gscC = tmp("gc.json", { connected: true, has_data: true, top_pages: [{ page: "https://c.example/", clicks: 0, impressions: 15, ctr: 0, position: 38 }] });
check("under 100 impressions = too little data", /too_little_data|owner kept$/.test(run("2026-10-20", "measure", "C", "--audit", auditC, "--gsc", gscC)) && json(run("2026-10-20", "brief", "C")).lessons.dropped.length === 0);


// the measurement timeline of ONE fix: day 3 (kept?), day 15 (early 7-day read), day 30 (the real 28-day verdict). The full verdict must still happen after the early looks.
run("2026-09-01", "add", entry("T", [fix("/", "title_short", "Old", "A better title for the timeline test", G(5, 400, 1.0, 15))]));
const auditT = tmp("t.json", { pages: [{ route: "/", title: "A better title for the timeline test", description: "x" }] });
const gscT7 = tmp("gt7.json", { connected: true, has_data: true, top_pages: [{ page: "https://t.example/", clicks: 4, impressions: 90, ctr: 4.4, position: 11 }] });
const gscT28 = tmp("gt28.json", { connected: true, has_data: true, top_pages: [{ page: "https://t.example/", clicks: 20, impressions: 520, ctr: 3.8, position: 11.5 }] });
check("day 3: a first look says whether the owner kept it, nothing about Google", /day-3 look\): owner kept$/.test(run("2026-09-04", "measure", "T", "--audit", auditT, "--gsc", gscT28).trim().split("\n")[0]));
check("day 15 asks for the early read (stage mid)", json(run("2026-09-16", "brief", "T")).due_for_measure[0]?.stage === "mid");
const mid = run("2026-09-16", "measure", "T", "--audit", auditT, "--gsc", gscT7, "--gsc-days", "7");
check("day 15: the early 7-day read is recorded but flagged as not counted", /early read/.test(mid), mid);
check("day 15: a 28-day file cannot give a verdict yet", /Nothing due/.test(run("2026-09-16", "measure", "T", "--audit", auditT, "--gsc", gscT28, "--gsc-days", "28")));
check("day 30: the full verdict is still due after the early looks", json(run("2026-10-01", "brief", "T")).due_for_measure[0]?.stage === "full");
const full = run("2026-10-01", "measure", "T", "--audit", auditT, "--gsc", gscT28, "--gsc-days", "28");
check("day 30: the 28-day verdict is recorded (improved) and counted once", /28-day measure\): owner kept, Google improved$/.test(full.trim().split("\n")[0]) && json(run("2026-10-01", "brief", "T")).due_for_measure.length === 0, full);
check("nothing is measured twice", /Nothing due/.test(run("2026-10-02", "measure", "T", "--audit", auditT, "--gsc", gscT28)));

// an apostrophe in a title must not break logging (JSON on stdin), and a run logged BEFORE publishing is visible as pending until it is closed
const pend = runIn("2026-10-05", JSON.stringify({ site: "P", name: "Pizza", pending: true, fixes: [{ page: "/", type: "title_short", before: "Pizza", after: "Luigi's Pizza - Wood-fired in Lyon" }], edits: [{ path: "src/pages/index.astro", find: 'title="Pizza"', replace: 'title="Luigi\'s Pizza - Wood-fired in Lyon"' }] }), "add", "-");
check("an apostrophe in a title is fine on stdin", /PENDING/.test(pend), pend);
check("a pending run shows in the brief (a run that died after editing is not forgotten)", json(run("2026-10-05", "brief", "P")).pending_run?.fixes === 1);
run("2026-10-05", "finish", "P", "--published", "--live-verified");
check("finish closes it", json(run("2026-10-05", "brief", "P")).pending_run === undefined && json(run("2026-10-05", "brief", "P")).touched_last_14d.length === 1);


// the schedule lines we print must use flags the installed agent CLIs really have (a flag that no longer exists silently breaks the cron job). Skipped for agents not installed here.
for (const [agentName, helpArgs] of [["claude", ["--help"]], ["codex", ["exec", "--help"]], ["grok", ["--help"]]]) {
  let helpText = null;
  try { helpText = execFileSync(agentName, helpArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch { continue; }
  const line = execFileSync("node", [path.join(HERE, "seo-schedule.mjs"), agentName], { encoding: "utf8" }).split("\n").find((l) => /^7 7 /.test(l)) || "";
  const flags = [...new Set([...line.matchAll(/ (--[a-z][a-z-]+)/g)].map((m) => m[1]))];
  const HIDDEN_BUT_ACCEPTED = ["--max-turns"]; // claude accepts --max-turns but does not list it in --help (an unknown option errors, this one does not: checked 2026-10-18)
  const bad = flags.filter((f) => !helpText.includes(f) && !(agentName === "claude" && HIDDEN_BUT_ACCEPTED.includes(f)));
  check(`schedule line for ${agentName}: every flag exists in the installed CLI (${flags.join(" ")})`, flags.length > 0 && bad.length === 0, `unknown: ${bad.join(" ")}`);
}

// pause is respected
run("2026-10-11", "mode", "A", "pause");
const p = json(run("2026-10-11", "brief", "A"));
check("pause means zero fixes left today", p.paused === true && p.remaining_today === 0);
check("weekly report runs", /Total: \d+ fix/.test(run("2026-10-11", "weekly", "--days", "60")));


// ── part 2: the site-facing logic against a FAKE Kleap CLI (a tiny script that keeps a site in a JSON file) ─────────────────────────────────────────────
const FAKE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "seo-fake-"));
const STATE = path.join(FAKE_DIR, "state.json");
fs.writeFileSync(path.join(FAKE_DIR, "kleap.mjs"), `
import fs from "node:fs";
const S = process.env.FAKE_STATE, st = JSON.parse(fs.readFileSync(S, "utf8")), now = process.env.FAKE_NOW || new Date().toISOString();
const a = process.argv.slice(2).filter((x) => x !== "--json");
const site = st.site, find = (x) => (String(x) === String(site.id) || x === site.slug || x === site.slug + ".kleap.io") ? site : null;
const out = (o) => console.log(JSON.stringify(o)), fail = (m) => { console.error(m); process.exit(1); };
const save = () => fs.writeFileSync(S, JSON.stringify(st));
const opt = (n) => a[a.indexOf(n) + 1];
if (a[0] === "status") { if (!find(a[1])) fail("NOT_FOUND"); out({ id: site.id, slug: site.slug, name: "Fake", production_url: "https://" + site.slug + ".kleap.io", ...(site.published_at ? { published_at: site.published_at } : {}) }); }
else if (a[0] === "files" && a[1] === "ls") { out({ files: Object.entries(site.files).map(([path, f]) => ({ path, updated_at: f.updated_at })) }); }
else if (a[0] === "files" && a[1] === "cat") { const f = site.files[a[3]]; if (!f) fail("NOT_FOUND"); out({ files: [{ path: a[3], content: f.content }] }); }
else if (a[0] === "files" && a[1] === "write") { site.files[a[3]] = { content: fs.readFileSync(opt("--file"), "utf8"), updated_at: now }; save(); out({ ok: true }); }
else if (a[0] === "files" && a[1] === "edit") { const f = site.files[a[3]]; const fi = opt("--find"), re = opt("--replace"); if (!f || !f.content.includes(fi)) fail("find text not found"); f.content = f.content.replace(fi, re); f.updated_at = now; save(); out({ ok: true }); }
else fail("unsupported in the fake: " + a.join(" "));
`);
const freshSite = () => fs.writeFileSync(STATE, JSON.stringify({ site: { id: 116838, slug: "hotel", published_at: null, files: {
  "src/pages/index.astro": { content: '<Base title="Hotel">Room to unwind.</Base>', updated_at: "2026-10-01T10:00:00Z" },
  "src/pages/rooms.astro": { content: "<Base>Rooms</Base>", updated_at: "2026-10-01T10:00:00Z" } } } }));
const stateNow = () => JSON.parse(fs.readFileSync(STATE, "utf8")).site;
const setSite = (fn) => { const st = JSON.parse(fs.readFileSync(STATE, "utf8")); fn(st.site); fs.writeFileSync(STATE, JSON.stringify(st)); };
const runF = (home, now, ...args) => {
  try { return { code: 0, out: execFileSync("node", [path.join(HERE, "seo-log.mjs"), ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, KLEAP_SEO_HOME: home, KLEAP_BIN: `node ${path.join(FAKE_DIR, "kleap.mjs")}`, FAKE_STATE: STATE, FAKE_NOW: now, KLEAP_SEO_TODAY: now.slice(0, 10), KLEAP_SEO_OFFLINE: "" } }) }; }
  catch (e) { return { code: e.status, out: String(e.stdout || "") + String(e.stderr || "") }; }
};
const H1 = fs.mkdtempSync(path.join(os.tmpdir(), "seo-m1-")), H2 = fs.mkdtempSync(path.join(os.tmpdir(), "seo-m2-"));
freshSite();

// one site = one history, whatever name the agent uses; an unknown name stops loudly instead of starting a ghost history
runF(H1, "2026-10-01T12:00:00Z", "add", entry("116838", [fix("/", "title_short", "Hotel", "Hotel Kleap - Rooms & Pool")], { edits: [{ path: "src/pages/index.astro", find: 'title="Hotel"', replace: 'title="Hotel Kleap - Rooms & Pool"' }] }));
const bySlug = runF(H1, "2026-10-02T12:00:00Z", "brief", "hotel.kleap.io");
check("a site named by its address shares the history of its id", bySlug.code === 0 && json(bySlug.out).site === "116838" && json(bySlug.out).touched_last_14d.length === 1, bySlug.out);
const ghost = runF(H1, "2026-10-02T12:00:00Z", "brief", "no-such-site.kleap.io");
check("an unresolvable site name stops loudly (no ghost history)", ghost.code === 3 && /cannot resolve/.test(ghost.out), ghost.out);

// the memory travels in the site; a pause set on machine 1 stops machine 2; the newest publish snapshot wins
setSite((x) => { x.files["src/pages/index.astro"] = { content: '<Base title="Hotel Kleap - Rooms & Pool">Room to unwind.</Base>', updated_at: "2026-10-01T12:00:05Z" }; });
runF(H1, "2026-10-01T12:01:00Z", "snapshot", "116838");
check("push saves the memory into the site", runF(H1, "2026-10-01T12:02:00Z", "push", "116838").code === 0 && !!stateNow().files[".kleap/seo-autopilot.json"]);
const pull2 = runF(H2, "2026-10-03T12:00:00Z", "pull", "hotel.kleap.io");
check("a second machine (named by address) pulls the same history", /1 run/.test(pull2.out) && json(runF(H2, "2026-10-03T12:00:00Z", "brief", "116838").out).first_run === false, pull2.out);
runF(H1, "2026-10-04T12:00:00Z", "mode", "116838", "pause");
runF(H2, "2026-10-04T12:05:00Z", "pull", "116838");
check("pause set on machine 1 stops machine 2", json(runF(H2, "2026-10-04T12:06:00Z", "brief", "116838").out).paused === true);
runF(H2, "2026-10-05T12:00:00Z", "mode", "116838", "auto");
runF(H1, "2026-10-05T12:05:00Z", "pull", "116838");
check("a newer mode set on machine 2 is adopted by machine 1", json(runF(H1, "2026-10-05T12:06:00Z", "brief", "116838").out).mode === "auto");

// drift: the owner edits and does NOT publish -> drift; the owner publishes (Kleap reports published_at) -> clean; or says so -> rebaseline -> clean
setSite((x) => { x.files["src/pages/index.astro"] = { content: '<Base title="Hotel Kleap - Rooms & Pool">Room to unwind. DRAFT</Base>', updated_at: "2026-10-06T09:00:00Z" }; });
check("an unpublished owner edit is drift", json(runF(H1, "2026-10-06T10:00:00Z", "drift", "116838").out).state === "drift");
setSite((x) => { x.published_at = "2026-10-06T09:30:00Z"; });
check("once Kleap says the site was published after that edit, it is clean (no deadlock for active owners)", json(runF(H1, "2026-10-06T10:00:00Z", "drift", "116838").out).state === "clean");
setSite((x) => { x.published_at = null; });
check("drift is back when the API says nothing", json(runF(H1, "2026-10-06T10:00:00Z", "drift", "116838").out).state === "drift");
runF(H1, "2026-10-06T10:05:00Z", "rebaseline", "116838");
check("rebaseline (the owner says they published) clears the drift", json(runF(H1, "2026-10-06T10:06:00Z", "drift", "116838").out).state === "clean");

// undo: reverses only the text we wrote; an owner who rewrote it keeps their version
const dry = runF(H1, "2026-10-07T12:00:00Z", "undo", "116838");
check("undo is a dry run by default", dry.code === 0 && /would run/.test(dry.out) && stateNow().files["src/pages/index.astro"].content.includes("Hotel Kleap - Rooms"), dry.out);
const done = runF(H1, "2026-10-07T12:01:00Z", "undo", "116838", "--apply");
check("undo --apply restores the old text and keeps the draft sentence", done.code === 0 && stateNow().files["src/pages/index.astro"].content === '<Base title="Hotel">Room to unwind. DRAFT</Base>', done.out + stateNow().files["src/pages/index.astro"].content);
check("an undone pair is blocked for 30 days", json(runF(H1, "2026-10-07T12:02:00Z", "brief", "116838").out).reverted_last_30d.includes("/|title_short"));
runF(H1, "2026-10-08T12:00:00Z", "add", entry("116838", [fix("/", "title_short", "Hotel", "Hotel Kleap - Rooms & Pool")], { edits: [{ path: "src/pages/index.astro", find: 'title="Hotel"', replace: 'title="Hotel Kleap - Rooms & Pool"' }] }));
setSite((x) => { x.files["src/pages/index.astro"].content = '<Base title="My own title">Room to unwind. DRAFT</Base>'; });
const kept = runF(H1, "2026-10-08T12:05:00Z", "undo", "116838", "--apply");
check("undo leaves text the owner rewrote alone", /kept as is/.test(kept.out) && stateNow().files["src/pages/index.astro"].content.includes("My own title"), kept.out);

// a memory written by the connector prompt (no shell) must be read by the scripts as if they had written it
const H3 = fs.mkdtempSync(path.join(os.tmpdir(), "seo-m3-"));
setSite((x) => { x.files[".kleap/seo-autopilot.json"] = { updated_at: "2026-10-09T12:00:00Z", content: JSON.stringify({ v: 1, site: "116838", mode: "auto", since: "2026-10-09T12:00:00Z",
  runs: [{ ts: "2026-10-09T12:00:00Z", score: { before: 50, after: 88 }, edits: [], fixes: [{ page: "/", type: "missing_alt", before: "<img>", after: 'alt="Pool"', analytics_before: { views: 12 } }], published: true, live_verified: true, reverted: false }], measures: [], snapshot: null }) }; });
runF(H3, "2026-10-10T12:00:00Z", "pull", "116838");
const fromConnector = json(runF(H3, "2026-10-10T12:00:00Z", "brief", "hotel.kleap.io").out);
check("a connector-written memory is understood by the scripts (cool-down, mode, score)", fromConnector.mode === "auto" && fromConnector.touched_last_14d.includes("/|missing_alt") && fromConnector.last_score === 88, JSON.stringify(fromConnector));
check("the weekly report reads it too", /checklist 50 -> 88\/100/.test(runF(H3, "2026-10-12T12:00:00Z", "weekly", "--days", "7").out));
fs.rmSync(H3, { recursive: true, force: true });

// a run the owner asked us to take back is not "the owner rewrote our wording": it must not pollute the style guide
const auditU = tmp("u.json", { pages: [{ route: "/", title: "Hotel", description: "x" }] });
const mU = runF(H1, "2026-10-12T12:00:00Z", "measure", "116838", "--audit", auditU);
check("an undone run is never counted as the owner's preferred wording", !/overridden/.test(mU.out) && !JSON.stringify(json(runF(H1, "2026-10-12T12:01:00Z", "brief", "116838").out).owner_style).includes("Hotel"), mU.out);
fs.rmSync(FAKE_DIR, { recursive: true, force: true });

// ── part 3: the free URL audit against a local fixture site (deterministic, no internet) ──────────────────────────────────────────────────────────────
const page = (title, desc, body, extraHead = "") => `<!doctype html><html lang="en"><head>${title ? `<title>${title}</title>` : ""}${desc ? `<meta name="description" content="${desc}">` : ""}<meta name="viewport" content="width=device-width"><link rel="canonical" href="http://x/">${extraHead}</head><body>${body}</body></html>`;
const ROUTES = {
  "/": page("Cafe Lyon", "", '<h1>Cafe</h1><a href="/about">About</a> <a href="/login">Log in</a> <a href="/missing">Menu</a> <a href="/secret">Offer</a> <a href="/index.html">Home</a> <a href="/privacy-policy">Privacy</a> <a href="/menu">Menu</a> <a href="/min">Min</a><img src="/a.jpg" alt="a"><img src="/a.jpg"><img src="/b.jpg" alt="">'),
  "/about": page("テスト用の日本語タイトルです長め", "これは日本語の説明文です。この説明は幅で数えると七十文字を超える長さがあり、検索結果に十分な情報を載せます。", "<h1>私たち</h1>" + "word ".repeat(150)),
  "/login": page("", "", "<form></form>"),
  "/secret": page("Private offer for friends of the cafe", "A private offer page that is deliberately hidden from Google on purpose.", "<h1>Offer</h1>" + "word ".repeat(150), '<meta name="robots" content="noindex">'),
  "/index.html": page("Cafe Lyon", "", '<h1>Cafe</h1>'),
  "/min": '<!doctype html><html lang=en><head><title>Minified page with a long enough title here</title><meta name=description content="A minified page whose attributes are not quoted, with a description long enough to pass the length check."><meta name=viewport content=width=device-width><link rel=canonical href=https://x/min></head><body><h1>Min</h1><a href=/about>About</a><img src=/m.jpg alt=Pool>'+"word ".repeat(150)+"</body></html>",
  "/privacy-policy": page("", "", "<h1>Privacy</h1>" + "word ".repeat(40)),
  "/menu": page("Roasting Beans Cafe Lyon Menu", "Our full menu of coffee, tea and pastries baked every morning in Lyon, with prices and allergens listed.", "<h1>Menu</h1>" + "word ".repeat(150)),
};
const server = http.createServer((req, res) => { const r = ROUTES[req.url.split("?")[0]]; if (!r) { res.statusCode = req.url === "/robots.txt" || req.url === "/sitemap.xml" ? 404 : 404; res.end("nope"); return; } res.setHeader("content-type", "text/html"); res.end(r); });
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const t0 = Date.now();
const { stdout } = await promisify(execFile)("node", [path.join(HERE, "seo-audit.mjs"), "--url", `http://127.0.0.1:${server.address().port}`, "--json"], { encoding: "utf8", timeout: 60000 });
server.close();
const A = JSON.parse(stdout);
const has = (page, type) => A.findings.some((f) => f.page === page && f.type === type);
check("URL audit: a dead link is reported once, on the page that has it", A.findings.filter((f) => f.type === "dead_internal_link" && /missing/.test(f.detail)).length === 1 && !has("/missing", "live_not_200"));
check("URL audit: login/utility pages are never findings", !A.findings.some((f) => f.page === "/login"));
check("URL audit: /index.html is the homepage, not a duplicate of it", !A.findings.some((f) => f.type === "duplicate_title"));
check("URL audit: a noindex page is a note for the owner, not a fix", !has("/secret", "noindex") && A.owner_notes.some((n) => /\/secret/.test(n)));
check("URL audit: a repeated image counts once, and one without alt is caught", A.findings.some((f) => f.page === "/" && f.type === "missing_alt" && /1 of 2/.test(f.detail)), JSON.stringify(A.findings.filter((f) => f.type === "missing_alt")));
check("URL audit: Japanese title and description are measured by width, not characters", !has("/about", "title_short") && !has("/about", "description_short"), JSON.stringify(A.findings.filter((f) => f.page === "/about")));
check("URL audit: the TOP 3 contain no utility page", A.top3.every((f) => !/login/.test(f.page)));
check("URL audit: minified HTML with unquoted attributes is read correctly (no false alarms)", !A.findings.some((f) => f.page === "/min" && f.type !== "no_page_schema"), JSON.stringify(A.findings.filter((f) => f.page === "/min")));
check("URL audit: legal pages are ignored like login pages", !A.findings.some((f) => f.page === "/privacy-policy"));
check("URL audit: a title 1 character under the limit is a note, not a priority", A.findings.some((f) => f.page === "/menu" && f.type === "title_short" && f.impact <= 2) && A.top3.every((f) => f.page !== "/menu"), JSON.stringify(A.findings.filter((f) => f.page === "/menu")));
check("URL audit: fast", Date.now() - t0 < 20000);

// ── part 4: Kleap-mode audit, source vs LIVE page (wrapper layouts, redirect/404 stubs, links made by components) ───────────────────────────────────────
{
  const pageHtml = (title, desc, h1, links = "") => `<!doctype html><html lang="fr"><head>${title ? `<title>${title}</title>` : ""}${desc ? `<meta name="description" content="${desc}">` : ""}<script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":"Person"}]}</script></head><body><main>${h1 ? `<h1>${h1}</h1>` : ""}${"word ".repeat(200)}${links}</main></body></html>`;
  const LIVE = {
    "/": pageHtml("Portfolio de Marie Dupont, developpeuse web a Lyon", "Marie Dupont cree des sites rapides pour les artisans de Lyon : cadrage, design, developpement et mise en ligne clef en main.", "Marie Dupont", '<a href="/linked-by-component/">x</a>'),
    "/linked-by-component": pageHtml("Page liee par un composant React pour les tests du pilote", "Cette page est liee uniquement depuis un composant, jamais depuis un fichier astro de la source, et reste donc visible.", "Linked"),
    "/about": pageHtml("", "", ""),
    "/target": pageHtml("Cible d une redirection volontaire pour les tests", "Une page cible dont le titre ne doit jamais etre juge comme celui de la page qui redirige vers elle, par construction.", "Cible"),
  };
  const srv = http.createServer((req, res) => {
    const u = req.url.split("?")[0].replace(/(.)\/$/, "$1");
    if (u === "/old") { res.statusCode = 301; res.setHeader("location", "/target"); return res.end(); }
    const r = LIVE[u]; if (!r) { res.statusCode = 404; return res.end("nope"); }
    res.setHeader("content-type", "text/html"); res.end(r);
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const FILES = {
    "src/layouts/Wrap.astro": "---\nimport Base from './Base.astro';\nconst {lang='fr'}=Astro.props;\n---\n<Base title='Portfolio de Marie Dupont, developpeuse web a Lyon' description='x' lang={lang}><slot/></Base>",
    "src/layouts/Base.astro": "---\nconst {title,description}=Astro.props;\n---\n<html><head><title>{title}</title></head><body><slot/></body></html>",
    "src/pages/index.astro": "---\nimport Wrap from '@/layouts/Wrap.astro';\n---\n<Wrap lang=\"fr\"><main>Portfolio</main></Wrap>",
    "src/pages/linked-by-component.astro": "---\nimport Wrap from '@/layouts/Wrap.astro';\n---\n<Wrap><main>Linked</main></Wrap>",
    "src/pages/about.astro": "---\nimport Base from '@/layouts/Base.astro';\n---\n<Base lang=\"fr\"><main>About us</main></Base>",
    "src/pages/old.astro": "---\nexport const prerender = false;\nreturn Astro.redirect('/target', 301);\n---",
    "src/pages/gone.astro": "---\nexport const prerender = false;\nreturn new Response(null, { status: 404 });\n---",
    "src/pages/target.astro": "---\nimport Wrap from '@/layouts/Wrap.astro';\n---\n<Wrap><main>Target</main></Wrap>",
  };
  const LIVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "seo-live-"));
  const cli = path.join(LIVE_DIR, "kleap-live.mjs");
  fs.writeFileSync(cli, `const a = process.argv.slice(2).filter((x) => x !== "--json"); const FILES = ${JSON.stringify(FILES)};
if (a[0] === "status") console.log(JSON.stringify({ app_id: 9, name: "Marie", production_url: ${JSON.stringify(base)} }));
else if (a[0] === "files" && a[1] === "ls") console.log(JSON.stringify({ files: Object.keys(FILES).map((path) => ({ path })) }));
else if (a[0] === "files" && a[1] === "cat") console.log(JSON.stringify({ files: a.slice(3).map((path) => ({ path, content: FILES[path] ?? "" })) }));
else { console.error("unsupported: " + a.join(" ")); process.exit(1); }`);
  const { stdout: kout } = await promisify(execFile)("node", [path.join(HERE, "seo-audit.mjs"), "9", "--live", "--no-gsc", "--json"], { encoding: "utf8", timeout: 60000, env: { ...process.env, KLEAP_BIN: `node ${cli}`, KLEAP_SEO_HOME: HOME } });
  const K = JSON.parse(kout);
  const kh = (page, type) => K.findings.some((f) => f.page === page && f.type === type);
  check("live audit: a title/description set by a wrapper layout is not reported missing", !kh("/", "missing_title") && !kh("/", "missing_description") && !kh("/", "no_h1"), JSON.stringify(K.findings.filter((f) => f.page === "/")));
  check("live audit: a page the LIVE site links to is not an orphan", !kh("/linked-by-component", "orphan_page"));
  check("live audit: a deliberate redirect and a 404 stub are left alone and told to the owner", !K.findings.some((f) => f.page === "/old" || f.page === "/gone") && K.owner_notes.some((n) => /\/old/.test(n)) && K.owner_notes.some((n) => /\/gone/.test(n)), JSON.stringify([K.owner_notes, K.findings.filter((f) => /old|gone/.test(f.page))]));
  check("live audit: a page that really has no title is still reported", kh("/about", "missing_title"), JSON.stringify(K.findings.filter((f) => f.page === "/about")));
  check("live audit: schema added by a wrapper (Person) is not reported missing", !kh("/", "no_page_schema"));
  srv.close();
  fs.rmSync(LIVE_DIR, { recursive: true, force: true });
}
 for (const d of [H1, H2]) fs.rmSync(d, { recursive: true, force: true });

console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed (synthetic data: this tests the mechanics, not SEO results)");
fs.rmSync(HOME, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
