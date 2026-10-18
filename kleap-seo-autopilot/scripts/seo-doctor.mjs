#!/usr/bin/env node
// kleap-seo-autopilot / seo-doctor.mjs — "is everything ready?" in one command. Read-only. Prints a checklist and the ONE next step.
//
//   node seo-doctor.mjs [site]         site = id, slug, URL or custom domain (optional; without it only the machine and login are checked)
//
// Checks: Node >= 18, the pinned Kleap CLI runs, you are signed in (login or key), credits/plan, memory folder writable, and for a site:
// it exists and is published, it is an Astro site, Search Console and analytics are readable by THIS login (INSUFFICIENT_SCOPE shows up here,
// not in the middle of a run), autonomy mode, drift since our last publish. Exit code 0 = ready, 1 = something to fix first.
import { execFileSync, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SITE = process.argv[2];
const HOME = process.env.KLEAP_SEO_HOME || path.join(os.homedir(), ".kleap-seo");
const BIN = (process.env.KLEAP_BIN || "npx -y kleap-cli@2.1.0").split(" ");
const SCRIPTS = path.dirname(new URL(import.meta.url).pathname);
const ENV = { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || "--dns-result-order=ipv4first" };
// independent CLI calls run in parallel (each `npx` start costs seconds); results are cached and read back by the sequential code below
const cache = new Map();
const keyOf = (a) => a.join("\u0000");
const runAsync = (args) => new Promise((resolve) => execFile(BIN[0], [...BIN.slice(1), ...args], { encoding: "utf8", timeout: 90000, env: ENV }, (err, stdout, stderr) => resolve(err ? { ok: false, out: String(stdout || "") + String(stderr || err.message) } : { ok: true, out: stdout })));
const prefetch = (list) => Promise.all(list.map(async (a) => cache.set(keyOf(a), await runAsync(a))));
const run = (args) => cache.get(keyOf(args)) ?? runSync(args);
const runSync = (args) => {
  try {
    return { ok: true, out: execFileSync(BIN[0], [...BIN.slice(1), ...args], { encoding: "utf8", timeout: 90000, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || "--dns-result-order=ipv4first" } }) };
  } catch (e) { return { ok: false, out: String(e.stdout || "") + String(e.stderr || e.message) }; }
};
const lines = [];
let blocker = null;
const row = (ok, label, detail = "", next = null) => {
  lines.push(`${ok === true ? "✓" : ok === "warn" ? "!" : "✗"} ${label}${detail ? " — " + detail : ""}`);
  if (ok === false && !blocker) blocker = next || detail;
};

// machine
const major = Number(process.versions.node.split(".")[0]);
row(major >= 18, `Node ${process.versions.node}`, major >= 18 ? "" : "Node 18 or newer is required", "install Node 18+ (https://nodejs.org)");
try { fs.mkdirSync(HOME, { recursive: true }); fs.accessSync(HOME, fs.constants.W_OK); row(true, `memory folder ${HOME}`, "writable"); }
catch { row(false, `memory folder ${HOME}`, "not writable", "set KLEAP_SEO_HOME to a writable folder"); }

// CLI + login
await prefetch([["--version"], ["auth", "status"], ["credits"], ...(SITE ? [["status", SITE, "--json"]] : [])]);
const ver = run(["--version"]);
row(ver.ok, `Kleap CLI ${ver.ok ? ver.out.trim() : ""}`, ver.ok ? "" : "npx could not run kleap-cli (offline? IPv6 trouble: export NODE_OPTIONS=--dns-result-order=ipv4first)", "make `npx -y kleap-cli@2.1.0 --version` work");
const auth = run(["auth", "status"]);
const authText = auth.out.trim().split("\n").pop() || "";
const signed = auth.ok && !/not signed in|no credentials/i.test(auth.out);
row(signed, "signed in to Kleap", signed ? authText.replace(/^\[kleap\]\s*/, "") : "not signed in", "sign in: `npx -y kleap-cli@2.1.0 auth login` (opens the browser), or for unattended runs set KLEAP_API_KEY (Full preset key from https://kleap.co/settings/api-key)");
if (signed) {
  const cr = run(["credits"]);
  row(cr.ok, "account reachable", cr.ok ? cr.out.trim().replace(/^✓\s*/, "") : cr.out.slice(0, 160), "the login is refused: run `npx -y kleap-cli@2.1.0 auth logout && npx -y kleap-cli@2.1.0 auth login`, or create a new Full key");
}

// site
let siteId = null;
if (SITE && signed) {
  const st = run(["status", SITE, "--json"]);
  let s = null; try { s = JSON.parse(st.out); } catch {}
  if (!st.ok || !s || s.error) row(false, `site ${SITE}`, "not found on this account", "use `npx -y kleap-cli@2.1.0 list --limit 20` to find the id, slug or address of the site");
  else {
    siteId = s.id ?? SITE;
    await prefetch([["files", "ls", String(siteId), "--json"], ["search-console", String(siteId), "--json"], ["analytics", String(siteId), "--period", "7d", "--json"]]);
    row(!!s.production_url, `site ${s.name} (${siteId})`, s.production_url ? `live: ${s.production_url}${s.custom_domain ? " (custom domain " + s.custom_domain + ")" : ""}` : "not published yet", "publish it first (npx -y kleap-cli@2.1.0 publish) — the autopilot only improves live sites");
    const ls = run(["files", "ls", String(siteId), "--json"]);
    let files = []; try { files = JSON.parse(ls.out).files.map((f) => f.path); } catch {}
    const astro = files.some((p) => /^src\/pages\/.+\.astro$/.test(p));
    row(astro ? true : "warn", "Astro site", astro ? `${files.filter((p) => /^src\/pages\//.test(p)).length} page file(s)` : "no src/pages/*.astro: the autopilot cannot fix this site, but `seo-audit.mjs --url` can still audit it");
    const sc = run(["search-console", String(siteId), "--json"]);
    if (/INSUFFICIENT_SCOPE|HTTP 40[13]/.test(sc.out)) row(false, "Search Console readable", "this login/key lacks the scope (INSUFFICIENT_SCOPE)", "run `npx -y kleap-cli@2.1.0 auth logout && npx -y kleap-cli@2.1.0 auth login` (older logins lack the analytics scope) or use a Full-preset key");
    else {
      let g = {}; try { g = JSON.parse(sc.out); } catch {}
      row(g.connected && g.site_selected !== false ? true : "warn", "Google Search Console", g.connected && g.site_selected !== false ? (g.has_data === false ? "connected, no data yet" : `${g.clicks} clicks / ${g.impressions} impressions (${g.period})`) : "not connected: the autopilot still fixes the on-page basics, but learns from Google only after the owner connects it (`npx -y kleap-cli@2.1.0 search-console connect <site>`; the API answers `requires_custom_domain: true` for a *.kleap.io address)");
    }
    const an = run(["analytics", String(siteId), "--period", "7d", "--json"]);
    row(!/INSUFFICIENT_SCOPE|HTTP 40[13]/.test(an.out) ? true : false, "analytics readable", "", "run `npx -y kleap-cli@2.1.0 auth logout && npx -y kleap-cli@2.1.0 auth login` or use a Full-preset key");
    const logEnv = { ...process.env, KLEAP_BIN: BIN.join(" ") };
    // read the memory kept in the site FIRST: mode, pause and history may have been set on another machine
    try { execFileSync("node", [path.join(SCRIPTS, "seo-log.mjs"), "pull", String(siteId)], { encoding: "utf8", env: logEnv, stdio: ["ignore", "pipe", "pipe"] }); } catch {}
    const modeOut = (() => { try { return JSON.parse(execFileSync("node", [path.join(SCRIPTS, "seo-log.mjs"), "brief", String(siteId)], { encoding: "utf8", env: logEnv })); } catch { return null; } })();
    if (modeOut) row(true, "autonomy", `mode ${modeOut.mode}${modeOut.first_run ? " (first run: it will propose, you approve)" : ""}${modeOut.paused ? " (PAUSED: it will do nothing until you say go)" : ""}, ${modeOut.remaining_today} fix(es) left today`);
    try {
      const d = JSON.parse(execFileSync("node", [path.join(SCRIPTS, "seo-log.mjs"), "drift", String(siteId)], { encoding: "utf8", env: logEnv }));
      row(d.state === "drift" ? "warn" : true, "unpublished edits", d.state === "none" ? "no snapshot yet (first run: a publish ships ALL unpublished edits, the agent will tell you)" : d.state === "clean" ? "none since our last publish" : `${d.changed.length} file(s) changed since our last publish: the agent will propose, not publish`);
    } catch {}
  }
}
console.log(lines.join("\n"));
console.log(blocker ? `\nNEXT: ${blocker}` : `\nREADY. ${SITE ? `Say: "Use the kleap-seo-autopilot skill on ${SITE}"` : "Name a site and say: \"Use the kleap-seo-autopilot skill on <site>\""}`);
process.exit(blocker ? 1 : 0);
