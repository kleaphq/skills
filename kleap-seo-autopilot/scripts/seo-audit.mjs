#!/usr/bin/env node
// kleap-seo-autopilot / seo-audit.mjs — deterministic, read-only SEO audit.
//
//   node seo-audit.mjs <app> [--json] [--live] [--no-gsc] [--max-pages 60] [--no-skip]     a Kleap (Astro) site, from its source files
//   node seo-audit.mjs --url https://example.com [--json] [--max-pages 12]                  ANY public site, no account, no Kleap CLI
//
// <app> = app id, slug, slug.kleap.io URL or connected custom domain (anything the kleap CLI accepts).
// Kleap mode calls only `npx -y kleap-cli@2.1.0 status`, `npx -y kleap-cli@2.1.0 files ls|cat`, `npx -y kleap-cli@2.1.0 search-console` (and, with --live, plain GET requests on the site's own
// public pages). External mode only does plain GET/HEAD requests on the public site. Neither mode writes or publishes anything.
//
// Output: a checklist score (our own, 0-100, NOT a Google metric), TOP 3 fixes (skipping what was fixed recently or reverted: it reads
// $KLEAP_SEO_HOME/log.jsonl unless --no-skip), growth ideas for when the basics are clean, Search Console state.
// Auth for Kleap mode is whatever the CLI already has (`npx -y kleap-cli@2.1.0 auth login` token or KLEAP_API_KEY). Zero dependencies, Node >= 18.
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first"); // some networks resolve an IPv6 address they cannot route: the free URL audit must not fail on the first command because of that
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import http from "node:http";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const VALUE_OPTS = ["--max-pages", "--url", "--max-seconds"];
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && VALUE_OPTS.includes(args[i - 1])));
const APP = positional[0];
const EXTERNAL_URL = opt("--url", null);
if (!APP && !EXTERNAL_URL) {
  console.error("usage: node seo-audit.mjs <app> [--json] [--live] [--no-gsc] [--no-skip]   |   node seo-audit.mjs --url https://example.com [--json] [--max-pages 12]");
  process.exit(2);
}
const AS_JSON = flag("--json");
const MAX_PAGES = Number(opt("--max-pages", EXTERNAL_URL ? 12 : 60));

// ── thresholds (tuned for small-business sites; change here, nowhere else) ──────────────────
// Google truncates by pixel width, not characters: CJK/full-width characters are about twice as wide, so they count double (a 28-char Japanese title is NOT too short)
const wlen = (s) => [...String(s)].reduce((n, c) => n + (/[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/.test(c) ? 2 : 1), 0);
// 404/410/5xx = the page is gone or broken. 401/403/429/999 or no answer = the site refuses OUR bot (rate limit, WAF): that is not a dead page, so it is never reported as one
const isGone = (st) => st === 404 || st === 410 || (st >= 500 && st <= 599);
const T = {
  titleMin: 30, titleMax: 60,
  descMin: 70, descMax: 160,
  thinWords: 120,
  gscMinImpressions: 100, gscMaxCtrPct: 2, gscMaxPosition: 20,
};

// ── kleap CLI wrapper (retries once: `fetch failed` is a transient network error) ───────────
// Pinned on purpose: a skill must not run an unreviewed new CLI version. Bump together with the skill.
const BIN = (process.env.KLEAP_BIN || "npx -y kleap-cli@2.1.0").split(" ");
function kleap(cliArgs, { json = true } = {}) {
  const full = [...BIN.slice(1), ...cliArgs, ...(json ? ["--json"] : [])];
  let last;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const out = execFileSync(BIN[0], full, {
        encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 120000,
        env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || "--dns-result-order=ipv4first" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      return json ? JSON.parse(out) : out;
    } catch (e) {
      last = String(e.stderr || e.stdout || e.message).slice(0, 400);
      if (/INSUFFICIENT_SCOPE|"code":"(UNAUTHORIZED|INVALID_API_KEY)"|HTTP 40[13]/.test(last)) break; // not transient
    }
  }
  const err = new Error(`kleap ${cliArgs.slice(0, 3).join(" ")} failed: ${last}`);
  err.auth = /INSUFFICIENT_SCOPE|UNAUTHORIZED|INVALID_API_KEY|HTTP 40[13]/.test(last);
  throw err;
}

// ── shared helpers ──────────────────────────────────────────────────────────────────────────
const decode1 = (s) => String(s).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const decode = (s) => decode1(decode1(s)); // twice: some pages double-encode (&amp;#039;)
const words = (t) => (t ? t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0);
const SEO_HOME = process.env.KLEAP_SEO_HOME || path.join(os.homedir(), ".kleap-seo");
const findings = [];
const add = (page, type, impact, detail, fix) => findings.push({ page, type, impact, detail, fix });
// the 10 checks that make the checklist score: finding type -> check name
const CHECK_OF = {
  missing_title: "title", title_short: "title", title_long: "title", missing_description: "description", description_short: "description", description_long: "description",
  duplicate_title: "unique_title", duplicate_description: "unique_description", no_h1: "h1", multiple_h1: "h1", missing_alt: "alt", dead_internal_link: "links",
  no_page_schema: "schema", thin_page: "content", orphan_page: "linked", no_layout: "title", missing_canonical: "canonical", missing_viewport: "viewport", missing_lang: "lang",
  noindex: "indexable", live_not_200: "status", missing_og_image: "social",
};

/** What was fixed recently / reverted, from the autopilot log: those (page,type) pairs must not come back as "TOP 3" on the next run. */
function blockedPairs(siteId) {
  const blocked = new Map();
  try {
    const f = path.join(SEO_HOME, "log.jsonl");
    if (!fs.existsSync(f) || flag("--no-skip") || !siteId) return blocked;
    const now = process.env.KLEAP_SEO_TODAY ? new Date(process.env.KLEAP_SEO_TODAY + "T12:00:00Z").getTime() : Date.now();
    for (const l of fs.readFileSync(f, "utf8").split("\n").filter(Boolean)) {
      let e; try { e = JSON.parse(l); } catch { continue; }
      if (String(e.site) !== String(siteId)) continue;
      const age = (now - Date.parse(e.ts)) / 864e5;
      for (const x of e.fixes || []) {
        const k = `${x.page}|${x.type}`;
        if (e.reverted && age <= 30) blocked.set(k, "reverted in the last 30 days: ask the owner before trying again");
        else if (!e.reverted && x.type === "gsc_low_ctr" && age <= 28) blocked.set(k, "rewritten, waiting for Google to re-crawl (judge in 2-4 weeks)");
        else if (!e.reverted && age <= 14 && !blocked.has(k)) blocked.set(k, `we fixed this on ${String(e.ts).slice(0, 10)} and the problem is present again: the page was changed after our fix. Tell the owner, do not overwrite their change on your own for 14 days`);
      }
    }
  } catch {}
  return blocked;
}

function scoreOf(pageRoutes, extraChecks = 0) {
  const perPage = (r) => (r === "/" ? 8 : 10);
  const total = pageRoutes.reduce((n, r) => n + perPage(r), 0) + extraChecks;
  const failed = new Set();
  for (const f of findings) {
    const c = CHECK_OF[f.type];
    if (!c) continue;
    for (const pg of String(f.page).split(" + ")) failed.add(`${pg}|${c}`);
  }
  const passed = Math.max(0, total - failed.size);
  return { passed, total, percent: total ? Math.round((100 * passed) / total) : 100, note: "Kleap autopilot checklist, not a Google metric" };
}

function pickTop3(blocked) {
  const sorted = [...findings].sort((a, b) => b.impact - a.impact);
  const seen = new Set(), top3 = [], waiting = [];
  for (const f of sorted) {
    const k = f.page + "|" + f.type;
    if (seen.has(k)) continue;
    seen.add(k);
    if (blocked.has(k)) { waiting.push({ ...f, reason: blocked.get(k) }); continue; }
    if (top3.length < 3) top3.push(f);
  }
  return { top3, waiting };
}

function render(report, { external }) {
  const { top3, findings: all, waiting, score, gsc, growth } = report;
  console.log(report.app_id == null ? `${report.production_url || report.url} — ${report.pages_audited} page${report.pages_audited === 1 ? "" : "s"} read, ${all.length} findings` : `${report.name} (${report.app_id}) — ${report.production_url || "NOT PUBLISHED"} — ${report.pages_audited} page${report.pages_audited === 1 ? "" : "s"}, ${all.length} findings`);
  console.log(`CHECKLIST: ${score.percent}/100 (${score.passed}/${score.total} checks pass) — our own checklist, not a Google metric`);
  if (!external) {
    if (gsc.state === "auth_error") console.log(`GSC: STOP — ${gsc.note}`);
    else console.log(`GSC: ${gsc.connected ? `${gsc.clicks} clicks / ${gsc.impressions} impressions (${gsc.period}), ${gsc.low_ctr_queries.length} low-CTR queries${gsc.no_data ? " (no data yet)" : ""}` : "not connected — " + String(gsc.note).slice(0, 110)}`);
  }
  console.log(top3.length ? "TOP 3:" : all.length && waiting.length ? "Nothing new to fix today (what is still open is on hold, see WAITING)." : "No findings: this site passes every check today.");
  top3.forEach((f, i) => console.log(` ${i + 1}. [${f.impact}] ${f.page}  ${f.type}: ${f.detail}\n      → ${f.fix}`));
  const rest = all.filter((f) => !top3.includes(f) && !waiting.some((w) => w.page === f.page && w.type === f.type));
  if (rest.length) console.log(`OTHER (${rest.length}): ` + rest.slice(0, 12).map((f) => `${f.page} ${f.type}`).join(" | "));
  if (waiting.length) console.log(`WAITING (${waiting.length}): ` + waiting.map((w) => `${w.page} ${w.type} (${w.reason})`).join(" | "));
  if (report.owner_notes?.length) console.log(`FOR THE OWNER (not fixes): ` + report.owner_notes.slice(0, 5).join(" | "));
  if (report.partial) console.log(`NOTE: partial audit, stopped after ${report.pages_audited} pages because the site was slow (45 s cap). Raise it with --max-seconds.`);
  if (growth.length) {
    console.log(`GROWTH IDEAS (owner approves each one, never applied automatically):`);
    growth.forEach((g) => console.log(`  - ${g.type}: ${g.why}`));
  }
  if (external) {
    console.log(`\nFixing these automatically (edit, publish, check it is live, undo on failure) works on sites hosted on Kleap: https://kleap.co`);
    console.log(`Already on Kleap? npx -y kleap-cli@2.1.0 auth login  — then run this skill on your site without --url.`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
//  EXTERNAL MODE: any public site, no account
// ═══════════════════════════════════════════════════════════════════════════════════════════
// Pages that exist for the product, not for Google: never worth a title rewrite, never in the TOP 3 (a login page is not the owner's problem).
const UTILITY = /^\/(log-?in|sign-?in|sign-?up|register|account|accounts|billing|checkout|cart|admin|dashboard|access|blocked|verify[\w-]*|unsubscribe|password|reset[\w-]*|thank-?you|thanks|confirm[\w-]*|oauth|auth|api|cdn-cgi|404|preferences|settings|invite)(\/|$)/i;

async function externalAudit() {
  const UA = { "user-agent": "kleap-seo-autopilot/0.3 (read-only audit; https://kleap.co)" };
  const deadline = Date.now() + Number(opt("--max-seconds", 45)) * 1000;
  // IPv4 first and our own redirect handling: on networks with a broken IPv6 route Node's fetch can time out four times in a row, https.request with family 4 does not.
  const rawGet = (u, { method = "GET", timeout = 6000, redirects = 5, family = 4 } = {}) => new Promise((resolve, reject) => {
    const url = new URL(u);
    const lib = url.protocol === "http:" ? http : https;
    const req = lib.request(url, { method, family, timeout, headers: { ...UA, "accept-encoding": "identity", accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) { res.resume(); resolve(rawGet(new URL(res.headers.location, url).href, { method, timeout, redirects: redirects - 1, family })); return; }
      const chunks = []; let size = 0, finished = false;
      const finish = () => { if (finished) return; finished = true; resolve({ status: res.statusCode, url: url.href, headers: { get: (k) => res.headers[String(k).toLowerCase()] ?? null }, text: async () => Buffer.concat(chunks).toString("utf8") }); };
      res.on("data", (c) => { size += c.length; if (size <= 2_000_000) chunks.push(c); else res.destroy(); });
      res.on("end", finish); res.on("close", finish); res.on("error", finish);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
  const get = async (u, init = {}) => {
    try { return await rawGet(u, { method: init.method || "GET" }); } catch (e) {
      if (!/ENOTFOUND|EAFNOSUPPORT|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH/.test(String(e.code || e.message))) { if (/timeout|ECONNRESET/.test(String(e.code || e.message))) return null; }
      try { return await fetch(u, { redirect: "follow", headers: UA, signal: AbortSignal.timeout(6000), ...init }); } catch { return null; } // IPv6-only hosts
    }
  };
  let start;
  try { start = new URL(/^https?:\/\//i.test(EXTERNAL_URL) ? EXTERNAL_URL : "https://" + EXTERNAL_URL); } catch { console.error("not a valid URL: " + EXTERNAL_URL); process.exit(2); }
  const home = await get(start.href);
  if (!home) { console.error(`could not reach ${start.href} (offline, blocked, or not a public site)`); process.exit(1); }
  const origin = new URL(home.url).origin;
  const sameSite = (u) => { try { const a = new URL(u).hostname.replace(/^www\./, ""); return a === new URL(origin).hostname.replace(/^www\./, ""); } catch { return false; } };
  const norm = (u) => { const x = new URL(u); x.hash = ""; x.search = ""; x.pathname = x.pathname.replace(/\/index(\.(?:html?|php))?$/i, "/"); return x.origin + (x.pathname.length > 1 ? x.pathname.replace(/\/+$/, "") : "/"); }; // /index.html IS the folder URL: one page, not two

  const parse = (html) => {
    const tag = (re) => { const m = html.match(re); return m ? decode(m[1].trim()) : null; };
    const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
    const meta = (key, val) => { for (const m of metas) { const k = (m.match(new RegExp(`\\b${key}\\s*=\\s*["']([^"']*)["']`, "i")) || [])[1]; if (k && k.toLowerCase() === val) { const c = (m.match(/\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i) || []); return decode((c[1] ?? c[2] ?? "").trim()); } } return null; };
    // images, counted once per distinct src (carousels and <picture> repeat the same image many times): missing alt = no occurrence of that src carries an alt attribute
    const bySrc = new Map();
    for (const t of [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0])) {
      const src = (t.match(/\b(?:data-src|src)\s*=\s*["']([^"']+)["']/i) || [])[1] || t;
      bySrc.set(src, (bySrc.has(src) ? bySrc.get(src) : true) && /\balt\s*=/i.test(t)); // an image is fine only if EVERY occurrence of it has alt
    }
    const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
    const links = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map((m) => (m[1] ?? m[2]).trim());
    return {
      title: tag(/<title[^>]*>([\s\S]*?)<\/title>/i), description: meta("name", "description"),
      canonical: (html.match(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i) || [])[1] || null,
      lang: (html.match(/<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i) || [])[1] || null,
      viewport: meta("name", "viewport"), robots: meta("name", "robots"), ogImage: meta("property", "og:image"),
      h1: (html.match(/<h1\b/gi) || []).length, imgs: bySrc.size, imgsMissingAlt: [...bySrc.values()].filter((hasAlt) => !hasAlt).length,
      jsonld: (html.match(/<script[^>]+application\/ld\+json/gi) || []).length,
      words: words(decode(body.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()), links,
      text: decode(body.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").toLowerCase(),
    };
  };

  const pages = new Map(); // url -> {status, ...parsed}
  const status = new Map();
  const seenQ = new Set();
  const homeUrl = norm(home.url);
  const ingest = async (u, r) => {
    status.set(u, r ? r.status : 0);
    if (!r) return null;
    const ct = r.headers.get("content-type") || "";
    if (r.status >= 400 || !/html/i.test(ct)) { if (r.status >= 400) pages.set(u, { status: r.status }); return null; }
    const p = parse(await r.text());
    pages.set(u, { status: r.status, ...p });
    return p;
  };
  const candidates = (p, u) => {
    const out = [];
    for (const h of p.links || []) {
      if (/^(mailto:|tel:|javascript:|#)/i.test(h)) continue;
      let abs; try { abs = new URL(h, u).href; } catch { continue; }
      if (!sameSite(abs)) continue;
      if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js|ico|xml|txt|mp4|woff2?)$/i.test(new URL(abs).pathname)) continue;
      out.push(norm(abs));
    }
    return out;
  };
  // 1. the homepage, alone. 2. the pages it links to (what a visitor can reach first), then the sitemap's pages. Utility pages (login, billing...) go last.
  seenQ.add(homeUrl);
  const hp = await ingest(homeUrl, home);
  const queue = [];
  const enqueue = (u) => { if (!seenQ.has(u) && !queue.includes(u)) queue.push(u); };
  if (hp) candidates(hp, homeUrl).forEach(enqueue);
  const sm = await get(origin + "/sitemap.xml") ?? null;
  let sitemapOk = !!sm && sm.status === 200;
  let smText = sitemapOk ? await sm.text() : "";
  if (!sitemapOk) { const si = await get(origin + "/sitemap-index.xml"); if (si && si.status === 200) { sitemapOk = true; smText = await si.text(); } }
  const locs = [...smText.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
  const subMaps = locs.filter((l) => /\.xml$/i.test(l)).slice(0, 2);
  for (const sub of subMaps) { const r = await get(sub); if (r && r.status === 200) locs.push(...[...(await r.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1])); }
  for (const l of locs.filter((l) => !/\.xml$/i.test(l) && sameSite(l))) { try { enqueue(norm(l)); } catch {} }
  const rank = (u) => (UTILITY.test(new URL(u).pathname) ? 1 : 0);
  queue.sort((x, y) => rank(x) - rank(y)); // stable: homepage links keep their order, utility pages sink

  // parallel crawl: 5 at a time, 6 s per request, 45 s in total (a slow site gives a partial audit, said so, instead of a minute-long wait)
  let partial = false;
  const active = new Set();
  while ((queue.length || active.size) && seenQ.size < MAX_PAGES) {
    if (Date.now() > deadline) { partial = true; break; }
    while (queue.length && active.size < 5 && seenQ.size < MAX_PAGES) {
      const u = queue.shift();
      if (seenQ.has(u)) continue;
      seenQ.add(u);
      const task = (async () => { const r = await get(u); const p = await ingest(u, r); if (p) candidates(p, u).forEach(enqueue); })().catch(() => {}).finally(() => active.delete(task));
      active.add(task);
    }
    if (active.size) await Promise.race(active);
  }
  await Promise.allSettled([...active]);
  const okPages = [...pages.entries()].filter(([, p]) => p.status < 400 && p.title !== undefined);
  const route = (u) => { const x = new URL(u); return x.pathname.length > 1 ? x.pathname : "/"; };

  const titleCount = {}, descCount = {};
  for (const [, p] of okPages) { if (p.title) titleCount[p.title.toLowerCase()] = (titleCount[p.title.toLowerCase()] || 0) + 1; if (p.description) descCount[p.description.toLowerCase()] = (descCount[p.description.toLowerCase()] || 0) + 1; }
  const dupReported = new Set();
  const owner_notes = [];
  for (const [u, p] of okPages) {
    const r = route(u);
    if (/noindex/i.test(p.robots || "")) {
      // deliberate on login/offer/thank-you pages, a disaster on the homepage: only the homepage is a finding, every other page is a note for the owner
      if (r === "/") add(r, "noindex", 9, "the HOMEPAGE carries a noindex robots tag (Google will not list the site)", "remove noindex from the homepage unless the site is meant to stay private");
      else owner_notes.push(`${r} is noindex (fine if intended, e.g. a login, thank-you or private offer page)`);
      continue;
    }
    if (UTILITY.test(r)) continue;
    if (!p.title) add(r, "missing_title", 10, "no <title>", "add a unique, keyword-led title (30-60 chars)");
    else {
      if (wlen(p.title) < T.titleMin) add(r, "title_short", 5, `title is ${wlen(p.title)} chars: "${p.title}"`, `rewrite to ${T.titleMin}-${T.titleMax} chars with the main keyword + business/location`);
      if (wlen(p.title) > T.titleMax) add(r, "title_long", 4, `title is ${wlen(p.title)} chars and will be truncated: "${p.title}"`, `shorten to <= ${T.titleMax} chars, keyword first`);
      const k = p.title.toLowerCase();
      if (titleCount[k] > 1 && !dupReported.has("t" + k)) { dupReported.add("t" + k); add(okPages.filter(([, q]) => q.title?.toLowerCase() === k).map(([x]) => route(x)).join(" + "), "duplicate_title", 8, `same title on ${titleCount[k]} pages: "${p.title}"`, "give each page its own title"); }
    }
    if (!p.description) add(r, "missing_description", 10, "no meta description (Google will invent a snippet)", "write a 70-160 char description that sells the click");
    else {
      if (wlen(p.description) < T.descMin) add(r, "description_short", 5, `description is ${wlen(p.description)} chars`, `expand to ${T.descMin}-${T.descMax} chars`);
      if (wlen(p.description) > T.descMax) add(r, "description_long", 3, `description is ${wlen(p.description)} chars and will be cut`, `trim to <= ${T.descMax}`);
      const k = p.description.toLowerCase();
      if (descCount[k] > 1 && !dupReported.has("d" + k)) { dupReported.add("d" + k); add(okPages.filter(([, q]) => q.description?.toLowerCase() === k).map(([x]) => route(x)).join(" + "), "duplicate_description", 7, `same description on ${descCount[k]} pages`, "give each page its own description"); }
    }
    if (p.h1 === 0) add(r, "no_h1", 6, "no <h1>", "add one <h1> with the main keyword");
    if (p.h1 > 1) add(r, "multiple_h1", 3, `${p.h1} <h1> elements`, "keep one <h1>");
    if (p.imgsMissingAlt > 0) add(r, "missing_alt", Math.min(8, 3 + p.imgsMissingAlt), `${p.imgsMissingAlt} of ${p.imgs} images have no alt attribute`, "add descriptive alt text");
    if (!p.canonical) add(r, "missing_canonical", 5, "no canonical link", "add <link rel=canonical> pointing to this page's preferred URL");
    if (!p.viewport) add(r, "missing_viewport", 6, "no viewport meta (bad on phones, Google indexes mobile first)", "add <meta name=viewport content=\"width=device-width, initial-scale=1\">");
    if (!p.lang) add(r, "missing_lang", 3, "<html> has no lang attribute", "add lang=\"xx\"");
    if (!p.ogImage && r === "/") add(r, "missing_og_image", 3, "no og:image (links shared on social have no preview)", "add an og:image");
    if (r === "/" && p.jsonld === 0) add(r, "no_page_schema", 4, "homepage has no JSON-LD structured data", "add Organization / LocalBusiness JSON-LD from facts the page shows");
    else if (r !== "/" && p.jsonld === 0) add(r, "no_page_schema", 2, "no JSON-LD on this page", "add the node that matches the page");
    if (r !== "/" && p.words < T.thinWords) add(r, "thin_page", 5, `about ${p.words} words of visible text`, "expand with useful, specific content");
  }
  // dead internal links: targets that answered >= 400 inside the crawl, plus a sample outside it
  const linkedFrom = new Map();
  for (const [u, p] of okPages) for (const h of p.links || []) { try { const abs = new URL(h, u).href; if (sameSite(abs) && !/\.[a-z0-9]{2,5}$/i.test(new URL(abs).pathname)) { const n = norm(abs); if (!linkedFrom.has(n)) linkedFrom.set(n, route(u)); } } catch {} }
  // a page that 404s AND is linked from another page is ONE problem (the dead link, reported below), not two: only report it alone when nothing on the site links to it (e.g. a sitemap entry)
  for (const [u, p] of pages) if (isGone(p.status) && !linkedFrom.has(norm(u))) add(route(u), "live_not_200", 10, `answers ${p.status}`, "fix or redirect the page");
  const toProbe = [...linkedFrom].filter(([n]) => status.get(n) === undefined && !UTILITY.test(new URL(n).pathname)).slice(0, 25);
  await Promise.all(toProbe.map(async ([n]) => { const r = Date.now() > deadline ? null : await get(n, { method: "HEAD" }); status.set(n, r ? r.status : 0); }));
  for (const [n, from] of linkedFrom) {
    const st = status.get(n);
    if (isGone(st) && !UTILITY.test(new URL(n).pathname)) add(from, "dead_internal_link", 7, `links to ${route(n)}, which answers ${st}`, "point it to an existing page or create the page");
  }
  const rb = await get(origin + "/robots.txt");
  if (!rb || rb.status !== 200) add("/robots.txt", "live_not_200", 3, "no robots.txt", "add one that allows crawling and points to the sitemap");
  if (!sitemapOk) add("/sitemap.xml", "live_not_200", 4, "no sitemap.xml or sitemap-index.xml", "publish a sitemap so Google finds every page");

  const routes = okPages.map(([u]) => route(u)).filter((r) => !UTILITY.test(r));
  const score = scoreOf(routes.length ? routes : ["/"]);
  const { top3, waiting } = pickTop3(new Map());
  const growth = [];
  if (okPages.length <= 2) growth.push({ type: "single_page_site", why: "a one-page site competes for one keyword set; dedicated pages for each service, product or room rank for far more searches" });
  if (!okPages.some(([, p]) => /faq|frequently asked|\?/.test((p.text || "").slice(0, 20000)) && p.jsonld > 0)) growth.push({ type: "no_faq", why: "no FAQ section with structured data: questions customers really ask can earn rich results" });
  const report = {
    mode: "external", url: origin, app_id: null, name: new URL(origin).hostname, production_url: origin, published: true,
    pages_audited: okPages.length, partial, owner_notes, finding_count: findings.length, top3, findings: findings.sort((a, b) => b.impact - a.impact), waiting, score, growth, gsc: { connected: false, note: "external mode" }, live: [],
    next_step: "Automatic fixing works on sites hosted on Kleap (https://kleap.co).",
  };
  if (AS_JSON) console.log(JSON.stringify(report, null, 2)); else render(report, { external: true });
}

if (EXTERNAL_URL) { await externalAudit(); process.exit(0); }

// ═══════════════════════════════════════════════════════════════════════════════════════════
//  KLEAP MODE: a Kleap (Astro) site, from its source files
// ═══════════════════════════════════════════════════════════════════════════════════════════
const stripFrontmatter = (s) => s.replace(/^---[\s\S]*?\n---\s*\n?/, "");
const frontmatter = (s) => (s.match(/^---([\s\S]*?)\n---/) || [, ""])[1];

/** Opening tag of the layout component (`<Base ...>`), attributes as {name: {kind, value}}. */
function layoutAttrs(src) {
  const fm = frontmatter(src);
  const imp = fm.match(/import\s+(\w+)\s+from\s+['"][^'"]*layouts\/[^'"]+['"]/);
  if (!imp) return null;
  const start = src.indexOf(`<${imp[1]}`, fm.length);
  if (start < 0) return null;
  let i = start + imp[1].length + 1, depth = 0, quote = null, tag = "";
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === quote && src[i - 1] !== "\\") quote = null; }
    else if (depth === 0 && (c === '"' || c === "'")) quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) break;
    tag += c;
  }
  const attrs = {};
  const re = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|\{)/g;
  let m;
  while ((m = re.exec(tag))) {
    if (m[2] === "{") {
      let d = 1, j = re.lastIndex;
      while (j < tag.length && d > 0) { if (tag[j] === "{") d++; else if (tag[j] === "}") d--; j++; }
      attrs[m[1]] = { kind: "expr", value: tag.slice(re.lastIndex, j - 1).trim() };
      re.lastIndex = j;
    } else attrs[m[1]] = { kind: "literal", value: m[3] ?? m[4] ?? "" };
  }
  // `title={"literal"}` / `title={`literal`}` with no ${} is still a literal
  for (const k of Object.keys(attrs)) {
    const a = attrs[k];
    const lit = a.kind === "expr" && a.value.match(/^(["'`])((?:(?!\1)[^\\$]|\\.)*)\1$/);
    if (lit) attrs[k] = { kind: "literal", value: lit[2] };
  }
  return attrs;
}

function visibleText(src) {
  return decode(
    stripFrontmatter(src)
      .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/\{[^{}]*\}/g, " ").replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
}

function routeOf(p) {
  let r = p.replace(/^src\/pages/, "").replace(/\.(astro|mdx?|html)$/, "").replace(/\/index$/, "");
  return r === "" ? "/" : r;
}
const isDynamic = (r) => /\[[^\]]+\]/.test(r);
const dynRe = (r) => new RegExp("^" + r.replace(/\[\.\.\.[^\]]+\]/g, ".+").replace(/\[[^\]]+\]/g, "[^/]+") + "$");

function internalLinks(src) {
  const out = new Set();
  for (const m of src.matchAll(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*[`"']([^`"'${}]*)[`"']\s*\})/g)) {
    let h = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (!h.startsWith("/") || h.startsWith("//")) continue;
    h = h.split("#")[0].split("?")[0];
    if (!h) continue;
    if (/\.[a-z0-9]{2,12}$/i.test(h) || /^\/(_|api\/|uploads\/|images\/|assets\/)/.test(h)) continue; // files, not pages
    out.add(h.length > 1 ? h.replace(/\/+$/, "") : h);
  }
  return out;
}

// ── 1. read the site ────────────────────────────────────────────────────────────────────────
let status;
try { status = kleap(["status", APP]); } catch (e) {
  console.error(e.auth ? `STOP: the Kleap login or key was refused (${String(e.message).slice(0, 160)}). Run: npx -y kleap-cli@2.1.0 auth logout && npx -y kleap-cli@2.1.0 auth login   (or create a Full key at https://kleap.co/settings/api-key)` : String(e.message));
  process.exit(e.auth ? 4 : 1);
}
const appId = status.app_id ?? status.id ?? APP;
const prodUrl = status.production_url ?? status.url ?? null;
const siteName = status.name ?? String(APP);

const ls = kleap(["files", "ls", String(appId)]);
const allPaths = (ls.files || ls).map((f) => (typeof f === "string" ? f : f.path));
const pagePaths = allPaths.filter((p) => /^src\/pages\/.+\.(astro|mdx?)$/.test(p) && !/\/404\.astro$/.test(p)).slice(0, MAX_PAGES);
const sharedPaths = allPaths.filter((p) => /^src\/(components|layouts)\/.+\.astro$/.test(p));
const publicPaths = new Set(allPaths.filter((p) => p.startsWith("public/")).map((p) => "/" + p.slice(7)));

const contents = {};
function readAll(paths) {
  for (let i = 0; i < paths.length; i += 15) {
    const res = kleap(["files", "cat", String(appId), ...paths.slice(i, i + 15)]);
    for (const f of res.files || []) contents[f.path] = f.content ?? "";
  }
}
if (pagePaths.length === 0) {
  const msg = `${siteName} (${appId}): no src/pages/*.astro found. This autopilot fixes Astro sites only (a legacy Next.js site has no such files). Nothing to do. (You can still audit its public pages: --url ${prodUrl || "<url>"})`;
  if (AS_JSON) console.log(JSON.stringify({ app_id: appId, name: siteName, supported: false, message: msg }));
  else console.log(msg);
  process.exit(3);
}
readAll([...pagePaths, ...sharedPaths]);

// ── 2. per-page facts ───────────────────────────────────────────────────────────────────────
const pages = pagePaths.map((p) => {
  const src = contents[p] || "";
  const attrs = layoutAttrs(src);
  const pick = (n) => (attrs && attrs[n] ? attrs[n] : null);
  // one level of component text, so a page built from <Hero/> <Services/> is not "thin"
  const compSrc = [...frontmatter(src).matchAll(/import\s+\w+\s+from\s+['"]([^'"]+\.astro)['"]/g)]
    .map((m) => m[1]).map((rel) => {
      const base = rel.replace(/^@\//, "src/");
      const cand = rel.startsWith("@/") ? [base] : [p.replace(/[^/]+$/, "") + rel].map((x) => x.replace(/[^/]+\/\.\.\//g, ""));
      return cand.map((c) => contents[c.replace(/^\.\//, "")] || "").join(" ");
    }).join(" ");
  const usesData = /from\s+['"][^'"]*(src\/data|\.\.\/data|@\/data)[^'"]*['"]|\.json['"]/.test(frontmatter(src));
  const imgTags = [...(src + " " + compSrc).matchAll(/<(?:img|Image)\b[^>]*>/gi)].map((m) => m[0]);
  const body = stripFrontmatter(src);
  const text = (visibleText(src) + " " + visibleText(compSrc)).trim();
  const h1Text = (body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [, ""])[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    path: p, route: routeOf(p), dynamic: isDynamic(routeOf(p)),
    hasLayout: !!attrs,
    title: pick("title"), description: pick("description"),
    hasSchema: !!pick("schema"), noindex: !!pick("noindex"),
    h1: (body.match(/<h1\b/gi) || []).length + (compSrc.match(/<h1\b/gi) || []).length, h1Text,
    imgs: imgTags.length,
    imgsMissingAlt: imgTags.filter((t) => !/\balt\s*=/.test(t) && !/\{\s*\.\.\./.test(t)).length,
    words: words(text), text: text.toLowerCase(),
    usesData,
    links: internalLinks(src),
  };
});

const sharedLinks = new Set(sharedPaths.flatMap((p) => [...internalLinks(contents[p] || "")]));
const staticRoutes = new Set(pages.filter((p) => !p.dynamic).map((p) => p.route));
const dynRoutes = pages.filter((p) => p.dynamic).map((p) => dynRe(p.route));
const routeExists = (r) => staticRoutes.has(r) || dynRoutes.some((re) => re.test(r)) || publicPaths.has(r) || r === "/404";

// ── 3. findings ─────────────────────────────────────────────────────────────────────────────
const titleCount = {}, descCount = {}, dupReported = new Set();
const routesWith = (get, v) => pages.filter((q) => get(q)?.kind === "literal" && get(q).value.toLowerCase() === v).map((q) => q.route);
for (const p of pages) {
  if (p.title?.kind === "literal") titleCount[p.title.value.toLowerCase()] = (titleCount[p.title.value.toLowerCase()] || 0) + 1;
  if (p.description?.kind === "literal") descCount[p.description.value.toLowerCase()] = (descCount[p.description.value.toLowerCase()] || 0) + 1;
}
for (const p of pages) {
  if (p.dynamic || p.noindex) continue;
  const r = p.route;
  if (!p.hasLayout) { add(r, "no_layout", 3, `${p.path} does not use a layouts/ component, so title/description/canonical are not managed here`, "wrap the page in <Base title description>"); continue; }
  const t = p.title, d = p.description;
  if (!t || (t.kind === "literal" && !t.value.trim())) add(r, "missing_title", 10, "no title passed to the layout (falls back to the bare site name)", "add a unique, keyword-led title (30-60 chars)");
  else if (t.kind === "literal") {
    const n = wlen(t.value);
    if (n < T.titleMin) add(r, "title_short", 5, `title is ${n} chars: "${t.value}"`, `rewrite to ${T.titleMin}-${T.titleMax} chars with the main keyword + business/location`);
    if (n > T.titleMax) add(r, "title_long", 4, `title is ${n} chars and will be truncated: "${t.value}"`, `shorten to <= ${T.titleMax} chars, keyword first`);
    const tk = "t:" + t.value.toLowerCase();
    if (titleCount[t.value.toLowerCase()] > 1 && !dupReported.has(tk)) { dupReported.add(tk); add(routesWith((q) => q.title, t.value.toLowerCase()).join(" + "), "duplicate_title", 8, `same title on ${titleCount[t.value.toLowerCase()]} pages: "${t.value}"`, "give each page its own title"); }
  }
  if (!d || (d.kind === "literal" && !d.value.trim())) add(r, "missing_description", 10, "no meta description passed to the layout (Google will invent a snippet)", "write a 70-160 char description that sells the click");
  else if (d.kind === "literal") {
    const n = wlen(d.value);
    if (n < T.descMin) add(r, "description_short", 5, `description is ${n} chars: "${d.value}"`, `expand to ${T.descMin}-${T.descMax} chars with a benefit and a call to action`);
    if (n > T.descMax) add(r, "description_long", 3, `description is ${n} chars and will be cut`, `trim to <= ${T.descMax} chars`);
    const dk = "d:" + d.value.toLowerCase();
    if (descCount[d.value.toLowerCase()] > 1 && !dupReported.has(dk)) { dupReported.add(dk); add(routesWith((q) => q.description, d.value.toLowerCase()).join(" + "), "duplicate_description", 7, `same description on ${descCount[d.value.toLowerCase()]} pages`, "give each page its own description"); }
  }
  if (p.h1 === 0) add(r, "no_h1", 6, "no <h1> on the page", "add one <h1> containing the main keyword");
  if (p.h1 > 1) add(r, "multiple_h1", 3, `${p.h1} <h1> elements`, "keep one <h1>, demote the others to <h2>");
  if (p.imgsMissingAlt > 0) add(r, "missing_alt", Math.min(8, 3 + p.imgsMissingAlt), `${p.imgsMissingAlt} of ${p.imgs} images have no alt attribute`, "add descriptive alt text (what the image shows + context), alt=\"\" only for pure decoration");
  if (!p.usesData && p.words < T.thinWords && r !== "/") add(r, "thin_page", 5, `about ${p.words} words of visible text`, "expand with useful, specific content (services, FAQs, proof) — do not pad");
  if (r === "/" && !p.hasSchema) add(r, "no_page_schema", 4, "homepage passes no schema= (Base only emits generic WebSite + WebPage JSON-LD)", "add a LocalBusiness/Organization node (and FAQPage if the page has real FAQs) through the layout's schema prop");
  else if (!p.hasSchema && r !== "/") add(r, "no_page_schema", 2, "no page-level JSON-LD", "add the node that matches the page (Service, FAQPage, Article, Product…) through the schema prop");
  for (const l of p.links) if (!routeExists(l)) add(r, "dead_internal_link", 9, `links to ${l}, which is not a page of this site`, "point it to an existing page, or create the page (never leave a dead link)");
}
for (const l of sharedLinks) if (!routeExists(l)) add("(shared nav/footer)", "dead_internal_link", 9, `shared component links to ${l}, which is not a page of this site`, "fix the link or create the page");
for (const p of pages) {
  if (p.dynamic || p.noindex || p.route === "/") continue;
  const inbound = sharedLinks.has(p.route) || pages.some((q) => q !== p && q.links.has(p.route));
  if (!inbound) add(p.route, "orphan_page", 6, "no other page or shared nav/footer links to this page", "link to it from the homepage, nav or a related page with descriptive anchor text");
}

// ── 4. Search Console ───────────────────────────────────────────────────────────────────────
let gsc = { connected: false, state: "skipped", note: "skipped (--no-gsc)" };
if (!flag("--no-gsc")) {
  try {
    const g = kleap(["search-console", String(appId)]);
    if (!g.connected || g.site_selected === false) gsc = { connected: false, state: g.connected ? "no_property" : "not_connected", note: g.message || "not connected" };
    else if (g.has_data === false) gsc = { connected: true, state: "no_data", no_data: true, clicks: 0, impressions: 0, period: g.period, low_ctr_queries: [], top_pages: [], note: g.note || g.message || "connected, no data yet" };
    else {
      const opp = (g.top_queries || []).filter((q) => q.impressions >= T.gscMinImpressions && q.ctr < T.gscMaxCtrPct && q.position <= T.gscMaxPosition);
      const topPage = [...(g.top_pages || [])].sort((a, b) => b.impressions - a.impressions)[0];
      gsc = { connected: true, state: "ok", period: g.period, clicks: g.clicks, impressions: g.impressions, ctr: g.ctr, position: g.position, top_pages: g.top_pages || [], top_queries: g.top_queries || [], low_ctr_queries: opp };
      // Search Console gives top queries and top pages as TWO lists. The page a query belongs to is the one whose title/h1/text actually uses the query's words
      // (ties: the page Google shows most). A query no page uses is not a metadata problem: it becomes a growth idea (query_without_page), never a title rewrite.
      const cand = pages.filter((p) => !p.dynamic && !p.noindex);
      const qtoks = (q) => q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);
      const pageImpr = Object.fromEntries((g.top_pages || []).map((tp) => { try { return [new URL(tp.page, "https://x").pathname.replace(/(.)\/$/, "$1"), tp.impressions]; } catch { return [tp.page, tp.impressions]; } }));
      const owner = (q) => {
        const t = qtoks(q.query);
        if (!t.length) return null;
        const scored = cand.map((p) => ({ p, cov: t.filter((w) => `${p.text} ${p.title?.value || ""} ${p.description?.value || ""}`.toLowerCase().includes(w)).length / t.length }))
          .sort((a, b) => b.cov - a.cov || (pageImpr[b.p.route] || 0) - (pageImpr[a.p.route] || 0));
        return scored[0] && scored[0].cov >= 0.67 ? scored[0].p : null;
      };
      for (const q of opp) {
        const own = owner(q);
        if (!own) continue;
        add(own.route, "gsc_low_ctr", 9,
          `"${q.query}": ${q.impressions} impressions, ${q.ctr}% CTR, position ${q.position}`,
          "rewrite the title + meta description of this page so they match the query intent (this page uses the query's words; Google lists queries and pages separately, so read the page before you write). Verify by the served title, not by this finding: it stays until Google re-crawls");
      }
    }
  } catch (e) {
    gsc = e.auth
      ? { connected: false, state: "auth_error", note: "this Kleap login or key cannot read Search Console (INSUFFICIENT_SCOPE or 401). Fix: `npx -y kleap-cli@2.1.0 auth logout && npx -y kleap-cli@2.1.0 auth login` (logins made with an older CLI lack the analytics scope) or use a Full-preset key. This is NOT the same as 'not connected'." }
      : { connected: false, state: "error", note: String(e.message).slice(0, 200) };
  }
}

// ── 5. live check (optional) ────────────────────────────────────────────────────────────────
const live = [];
let hasLlms = null;
if (flag("--live") && prodUrl) {
  for (const p of pages.filter((x) => !x.dynamic).slice(0, 30)) {
    try {
      const res = await fetch(new URL(p.route, prodUrl), { redirect: "follow", headers: { "user-agent": "kleap-seo-autopilot" } });
      const html = await res.text();
      const meta = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [, ""])[1];
      const lt = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ""])[1].trim());
      const lh = decode((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [, ""])[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      live.push({ route: p.route, status: res.status, title: lt, description: decode(meta), h1: lh });
      if (res.status !== 200) add(p.route, "live_not_200", 10, `live URL answers ${res.status}`, "publish again and check get_publish_status");
      else {
        const diffs = [];
        if (p.title?.kind === "literal" && lt && lt !== decode(p.title.value)) diffs.push(`title live "${lt}" vs source "${p.title.value}"`);
        if (p.description?.kind === "literal" && meta && decode(meta) !== decode(p.description.value)) diffs.push("meta description differs");
        if (diffs.length) add(p.route, "live_title_differs", 4, `source and live site differ (${diffs.join("; ")}): either a publish is pending or there are unpublished edits that a publish would also ship`, "publish, then re-check; if you did not make the difference, tell the owner before publishing");
      }
    } catch (e) { live.push({ route: p.route, error: String(e.message).slice(0, 80) }); }
  }
  for (const f of ["/robots.txt", "/sitemap-index.xml"]) {
    try { const r = await fetch(new URL(f, prodUrl)); live.push({ route: f, status: r.status }); if (r.status !== 200) add(f, "live_not_200", 6, `${f} answers ${r.status}`, "publish again; robots.txt lives in public/"); } catch {}
  }
  try { const r = await fetch(new URL("/llms.txt", prodUrl)); hasLlms = r.status === 200; } catch {}
}

// ── 6. growth ideas (only ever proposals) ───────────────────────────────────────────────────
const growth = [];
const statics = pages.filter((p) => !p.dynamic && !p.noindex);
if (statics.length <= 2) growth.push({ type: "single_page_site", why: "a one-page site competes for one keyword set; a dedicated page for each service, room or product (built only from facts the site already shows) ranks for far more searches" });
if (gsc.state === "ok") {
  const toks = (q) => q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);
  for (const q of (gsc.top_queries || []).filter((x) => x.impressions >= 20 && x.position <= 40).slice(0, 10)) {
    const t = toks(q.query);
    if (!t.length) continue;
    const best = Math.max(...statics.map((p) => t.filter((w) => (p.text + " " + (p.title?.value || "") + " " + (p.description?.value || "")).toLowerCase().includes(w)).length / t.length));
    if (best < 0.67) growth.push({ type: "query_without_page", why: `"${q.query}" shows your site (${q.impressions} impressions, position ${q.position}) but no page uses those words: propose a section or page that answers it` });
  }
}
if (!statics.some((p) => /faq|frequently asked/.test(p.text) || p.hasSchema && /FAQPage/.test(contents[p.path] || "")) && statics.some((p) => p.words >= T.thinWords)) growth.push({ type: "no_faq", why: "no FAQ section: real questions customers ask can earn rich results (use only questions and answers the owner confirms)" });
if (hasLlms === false) growth.push({ type: "no_llms_txt", why: "no /llms.txt: a short plain-text summary of the business helps AI search tools describe it correctly (write it only from facts the site shows)" });

// ── 7. output ───────────────────────────────────────────────────────────────────────────────
const blocked = blockedPairs(appId);
const score = scoreOf(statics.map((p) => p.route));
const { top3, waiting } = pickTop3(blocked);
const report = {
  mode: "kleap", app_id: appId, name: siteName, production_url: prodUrl, published: !!prodUrl,
  pages_audited: statics.length, dynamic_routes_skipped: pages.filter((p) => p.dynamic).map((p) => p.route),
  finding_count: findings.length, score, top3, waiting, findings: [...findings].sort((a, b) => b.impact - a.impact), growth: growth.slice(0, 5), gsc, live,
  // current facts per page: `seo-log.mjs measure` compares these with what the autopilot wrote earlier (did the owner keep it?)
  pages: statics.map((p) => ({
    route: p.route, title: p.title?.kind === "literal" ? p.title.value : null, description: p.description?.kind === "literal" ? p.description.value : null,
    h1: p.h1, images: p.imgs, images_missing_alt: p.imgsMissingAlt, words: p.words, has_schema: p.hasSchema,
  })),
};
if (AS_JSON) console.log(JSON.stringify(report, null, 2));
else render(report, { external: false });
