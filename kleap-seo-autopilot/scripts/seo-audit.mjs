#!/usr/bin/env node
// kleap-seo-autopilot / seo-audit.mjs — deterministic SEO audit of ONE Kleap (Astro) site.
//
//   node seo-audit.mjs <app> [--json] [--live] [--no-gsc] [--max-pages 60]
//
// <app> = app id, slug, slug.kleap.io URL or connected custom domain (anything the kleap CLI accepts).
// Read-only: it only calls `kleap files ls`, `kleap files cat`, `kleap status`, `kleap search-console`
// (and, with --live, plain GET requests on the site's own public pages). It never writes or publishes.
//
// Auth is whatever the kleap CLI already has: `kleap auth login` token or KLEAP_API_KEY.
// Zero dependencies, Node >= 18.
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && ["--max-pages"].includes(args[i - 1])));
const APP = positional[0];
if (!APP) {
  console.error("usage: node seo-audit.mjs <app> [--json] [--live] [--no-gsc] [--max-pages 60]");
  process.exit(2);
}
const AS_JSON = flag("--json");
const MAX_PAGES = Number(opt("--max-pages", 60));

// ── thresholds (tuned for small-business sites; change here, nowhere else) ──────────────────
const T = {
  titleMin: 30, titleMax: 60,
  descMin: 70, descMax: 160,
  thinWords: 120,
  gscMinImpressions: 100, gscMaxCtrPct: 2, gscMaxPosition: 20,
};

// ── kleap CLI wrapper (retries once: `fetch failed` is a transient network error) ───────────
const BIN = (process.env.KLEAP_BIN || "npx -y kleap-cli@latest").split(" ");
function kleap(cliArgs, { json = true } = {}) {
  const full = [...BIN.slice(1), ...cliArgs, ...(json ? ["--json"] : [])];
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const out = execFileSync(BIN[0], full, {
        encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 120000,
        env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || "--dns-result-order=ipv4first" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      return json ? JSON.parse(out) : out;
    } catch (e) {
      const msg = String(e.stderr || e.stdout || e.message).slice(0, 300);
      if (attempt === 2) throw new Error(`kleap ${cliArgs.slice(0, 3).join(" ")} failed: ${msg}`);
    }
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────────────────────
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

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
function visibleText(src) {
  return decode(
    stripFrontmatter(src)
      .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/\{[^{}]*\}/g, " ").replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
}
const words = (t) => (t ? t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0);

function routeOf(path) {
  let r = path.replace(/^src\/pages/, "").replace(/\.(astro|mdx?|html)$/, "").replace(/\/index$/, "");
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
const status = kleap(["status", APP]);
const appId = status.app_id ?? status.id ?? APP;
const prodUrl = status.production_url ?? status.url ?? null;
const siteName = status.name ?? String(APP);

const ls = kleap(["files", "ls", String(appId)]);
const allPaths = (ls.files || ls).map((f) => (typeof f === "string" ? f : f.path));
const pagePaths = allPaths.filter((p) => /^src\/pages\/.+\.(astro|mdx?)$/.test(p) && !/\/404\.astro$/.test(p)).slice(0, MAX_PAGES);
const sharedPaths = allPaths.filter((p) => /^src\/(components|layouts)\/.+\.astro$/.test(p));
const dataPaths = new Set(allPaths.filter((p) => p.startsWith("src/data/")));
const publicPaths = new Set(allPaths.filter((p) => p.startsWith("public/")).map((p) => "/" + p.slice(7)));

const contents = {};
async function readAll(paths) {
  for (let i = 0; i < paths.length; i += 15) {
    const res = kleap(["files", "cat", String(appId), ...paths.slice(i, i + 15)]);
    for (const f of res.files || []) contents[f.path] = f.content ?? "";
  }
}
if (pagePaths.length === 0) {
  const msg = `${siteName} (${appId}): no src/pages/*.astro found. This autopilot audits Astro sites only (a legacy Next.js site has no such files). Nothing to do.`;
  if (AS_JSON) console.log(JSON.stringify({ app_id: appId, name: siteName, supported: false, message: msg }));
  else console.log(msg);
  process.exit(3);
}
await readAll([...pagePaths, ...sharedPaths]);

// ── 2. per-page facts ───────────────────────────────────────────────────────────────────────
const pages = pagePaths.map((path) => {
  const src = contents[path] || "";
  const attrs = layoutAttrs(src);
  const pick = (n) => (attrs && attrs[n] ? attrs[n] : null);
  // one level of component text, so a page built from <Hero/> <Services/> is not "thin"
  const compSrc = [...frontmatter(src).matchAll(/import\s+\w+\s+from\s+['"]([^'"]+\.astro)['"]/g)]
    .map((m) => m[1]).map((rel) => {
      const base = rel.replace(/^@\//, "src/");
      const cand = rel.startsWith("@/") ? [base] : [path.replace(/[^/]+$/, "") + rel].map((p) => p.replace(/[^/]+\/\.\.\//g, ""));
      return cand.map((c) => contents[c.replace(/^\.\//, "")] || "").join(" ");
    }).join(" ");
  const usesData = /from\s+['"][^'"]*(src\/data|\.\.\/data|@\/data)[^'"]*['"]|\.json['"]/.test(frontmatter(src));
  const imgTags = [...(src + " " + compSrc).matchAll(/<(?:img|Image)\b[^>]*>/gi)].map((m) => m[0]);
  const body = stripFrontmatter(src);
  return {
    path, route: routeOf(path), dynamic: isDynamic(routeOf(path)),
    hasLayout: !!attrs,
    title: pick("title"), description: pick("description"),
    hasSchema: !!pick("schema"), noindex: !!pick("noindex"),
    h1: (body.match(/<h1\b/gi) || []).length + (compSrc.match(/<h1\b/gi) || []).length,
    imgs: imgTags.length,
    imgsMissingAlt: imgTags.filter((t) => !/\balt\s*=/.test(t) && !/\{\s*\.\.\./.test(t)).length,
    words: words(visibleText(src)) + words(visibleText(compSrc)),
    usesData,
    links: internalLinks(src),
  };
});

const sharedLinks = new Set(sharedPaths.flatMap((p) => [...internalLinks(contents[p] || "")]));
const staticRoutes = new Set(pages.filter((p) => !p.dynamic).map((p) => p.route));
const dynRoutes = pages.filter((p) => p.dynamic).map((p) => dynRe(p.route));
const routeExists = (r) => staticRoutes.has(r) || dynRoutes.some((re) => re.test(r)) || publicPaths.has(r) || r === "/404";

// ── 3. findings ─────────────────────────────────────────────────────────────────────────────
const findings = [];
const add = (page, type, impact, detail, fix) => findings.push({ page, type, impact, detail, fix });
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
    const n = t.value.length;
    if (n < T.titleMin) add(r, "title_short", 5, `title is ${n} chars: "${t.value}"`, `rewrite to ${T.titleMin}-${T.titleMax} chars with the main keyword + business/location`);
    if (n > T.titleMax) add(r, "title_long", 4, `title is ${n} chars and will be truncated: "${t.value}"`, `shorten to <= ${T.titleMax} chars, keyword first`);
    const tk = "t:" + t.value.toLowerCase();
    if (titleCount[t.value.toLowerCase()] > 1 && !dupReported.has(tk)) { dupReported.add(tk); add(routesWith((q) => q.title, t.value.toLowerCase()).join(" + "), "duplicate_title", 8, `same title on ${titleCount[t.value.toLowerCase()]} pages: "${t.value}"`, "give each page its own title"); }
  }
  if (!d || (d.kind === "literal" && !d.value.trim())) add(r, "missing_description", 10, "no meta description passed to the layout (Google will invent a snippet)", "write a 70-160 char description that sells the click");
  else if (d.kind === "literal") {
    const n = d.value.length;
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
  for (const l of p.links) if (!routeExists(l)) add(r, "dead_internal_link", 7, `links to ${l}, which is not a page of this site`, "point it to an existing page, or create the page (never leave a dead link)");
}
for (const l of sharedLinks) if (!routeExists(l)) add("(shared nav/footer)", "dead_internal_link", 8, `shared component links to ${l}, which is not a page of this site`, "fix the link or create the page");
for (const p of pages) {
  if (p.dynamic || p.noindex || p.route === "/") continue;
  const inbound = sharedLinks.has(p.route) || pages.some((q) => q !== p && q.links.has(p.route));
  if (!inbound) add(p.route, "orphan_page", 6, "no other page or shared nav/footer links to this page", "link to it from the homepage, nav or a related page with descriptive anchor text");
}

// ── 4. Search Console ───────────────────────────────────────────────────────────────────────
let gsc = { connected: false, note: "skipped (--no-gsc)" };
if (!flag("--no-gsc")) {
  try {
    const g = kleap(["search-console", String(appId)]);
    if (!g.connected || g.site_selected === false) gsc = { connected: false, note: g.message || "not connected" };
    else if (g.has_data === false) gsc = { connected: true, no_data: true, clicks: 0, impressions: 0, period: g.period, low_ctr_queries: [], note: g.note || g.message || "connected, no data yet" };
    else {
      const opp = (g.top_queries || []).filter((q) => q.impressions >= T.gscMinImpressions && q.ctr < T.gscMaxCtrPct && q.position <= T.gscMaxPosition);
      const topPage = [...(g.top_pages || [])].sort((a, b) => b.impressions - a.impressions)[0];
      gsc = { connected: true, period: g.period, clicks: g.clicks, impressions: g.impressions, ctr: g.ctr, position: g.position, top_pages: (g.top_pages || []).slice(0, 5), low_ctr_queries: opp };
      for (const q of opp) {
        add(topPage ? new URL(topPage.page, "https://x").pathname : "(unknown page)", "gsc_low_ctr", 9,
          `"${q.query}": ${q.impressions} impressions, ${q.ctr}% CTR, position ${q.position}`,
          "rewrite the title + meta description of the page that ranks for it so they match the query intent (queries and pages are separate lists: confirm the page by reading its content)");
      }
    }
  } catch (e) { gsc = { connected: false, note: String(e.message).slice(0, 200) }; }
}

// ── 5. live check (optional) ────────────────────────────────────────────────────────────────
const live = [];
if (flag("--live") && prodUrl) {
  for (const p of pages.filter((x) => !x.dynamic).slice(0, 30)) {
    try {
      const res = await fetch(new URL(p.route, prodUrl), { redirect: "follow", headers: { "user-agent": "kleap-seo-autopilot" } });
      const html = await res.text();
      const lt = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ""])[1].trim());
      live.push({ route: p.route, status: res.status, title: lt });
      if (res.status !== 200) add(p.route, "live_not_200", 10, `live URL answers ${res.status}`, "publish again and check get_publish_status");
      else if (p.title?.kind === "literal" && lt && lt !== decode(p.title.value)) add(p.route, "live_title_differs", 4, `live title "${lt}" differs from source "${p.title.value}"`, "publish, then re-check (the new version may not be serving yet)");
    } catch (e) { live.push({ route: p.route, error: String(e.message).slice(0, 80) }); }
  }
  for (const f of ["/robots.txt", "/sitemap-index.xml"]) {
    try { const r = await fetch(new URL(f, prodUrl)); live.push({ route: f, status: r.status }); if (r.status !== 200) add(f, "live_not_200", 6, `${f} answers ${r.status}`, "publish again; robots.txt lives in public/"); } catch {}
  }
}

// ── 6. output ───────────────────────────────────────────────────────────────────────────────
findings.sort((a, b) => b.impact - a.impact);
// top 3 = highest impact, at most one finding TYPE per page, so the three fixes are three different things
const seen = new Set(), top3 = [];
for (const f of findings) { const k = f.page + "|" + f.type; if (!seen.has(k)) { seen.add(k); top3.push(f); } if (top3.length === 3) break; }

const report = {
  app_id: appId, name: siteName, production_url: prodUrl, published: !!prodUrl,
  pages_audited: pages.filter((p) => !p.dynamic).length, dynamic_routes_skipped: pages.filter((p) => p.dynamic).map((p) => p.route),
  finding_count: findings.length, top3, findings, gsc, live,
};
if (AS_JSON) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`${siteName} (${appId}) — ${prodUrl || "NOT PUBLISHED"} — ${report.pages_audited} pages, ${findings.length} findings`);
  console.log(`GSC: ${gsc.connected ? `${gsc.clicks} clicks / ${gsc.impressions} impressions (${gsc.period}), ${gsc.low_ctr_queries.length} low-CTR queries${gsc.no_data ? " (no data yet)" : ""}` : "not connected — " + String(gsc.note).slice(0, 90)}`);
  console.log(top3.length ? "TOP 3:" : "No findings: nothing to fix on this site today.");
  top3.forEach((f, i) => console.log(` ${i + 1}. [${f.impact}] ${f.page}  ${f.type}: ${f.detail}\n      → ${f.fix}`));
  const rest = findings.filter((f) => !top3.includes(f));
  if (rest.length) console.log(`OTHER (${rest.length}): ` + rest.slice(0, 12).map((f) => `${f.page} ${f.type}`).join(" | "));
}
