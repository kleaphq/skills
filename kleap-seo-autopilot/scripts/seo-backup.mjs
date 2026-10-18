#!/usr/bin/env node
// kleap-seo-autopilot / seo-backup.mjs — back a file up before you change it, put it back if the change goes wrong.
//
//   node seo-backup.mjs backup  <app> <path...>            copy the CURRENT source of each file to $KLEAP_SEO_HOME/backups/<app>/<date>/<path>
//   node seo-backup.mjs restore <app> <path> [--date D]    write the newest backup (or the one from date D) back with `kleap files write`
//   node seo-backup.mjs list    <app>                      what is backed up
//
// After a restore you still run `kleap publish <app>` yourself (one publish per run, you decide when).
// Uses the kleap CLI and whatever auth it already has (`kleap auth login` or KLEAP_API_KEY). Zero dependencies, Node >= 18.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME = process.env.KLEAP_SEO_HOME || path.join(os.homedir(), ".kleap-seo");
const BIN = (process.env.KLEAP_BIN || "npx -y kleap-cli@2.1.0").split(" ");
const [cmd, app, ...rest] = process.argv.slice(2);
const today = (process.env.KLEAP_SEO_TODAY || new Date().toISOString()).slice(0, 10);

function kleap(args) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return execFileSync(BIN[0], [...BIN.slice(1), ...args], {
        encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 120000,
        env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || "--dns-result-order=ipv4first" },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      if (attempt === 2) throw new Error(String(e.stderr || e.message).slice(0, 300));
    }
  }
}
const die = (m) => { console.error(m); process.exit(1); };
if (!cmd || !app) die("usage: seo-backup.mjs backup <app> <path...> | restore <app> <path> [--date YYYY-MM-DD] | list <app>");
const dir = path.join(HOME, "backups", String(app));

if (cmd === "backup") {
  const files = rest.filter((a) => !a.startsWith("--"));
  if (!files.length) die("give at least one file path, e.g. src/pages/index.astro");
  const res = JSON.parse(kleap(["files", "cat", app, ...files, "--json"]));
  for (const f of res.files || []) {
    if (f.content == null) die(`could not read ${f.path}`);
    const out = path.join(dir, today, f.path);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    // the first backup of the day wins: it is the state before this run touched anything
    if (!fs.existsSync(out)) fs.writeFileSync(out, f.content);
    console.log(`backed up ${f.path} (${f.content.length} bytes) -> ${out}`);
  }
} else if (cmd === "restore") {
  const p = rest.find((a) => !a.startsWith("--"));
  const di = rest.indexOf("--date");
  if (!p) die("usage: seo-backup.mjs restore <app> <path> [--date YYYY-MM-DD]");
  const dates = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
  const date = di >= 0 ? rest[di + 1] : [...dates].reverse().find((d) => fs.existsSync(path.join(dir, d, p)));
  const src = date && path.join(dir, date, p);
  if (!src || !fs.existsSync(src)) die(`no backup of ${p} for ${app}${date ? " on " + date : ""}`);
  kleap(["files", "write", app, p, "--file", src]);
  console.log(`restored ${p} from ${date}. Now run: kleap publish ${app}`);
} else if (cmd === "list") {
  if (!fs.existsSync(dir)) { console.log("no backups yet"); process.exit(0); }
  for (const d of fs.readdirSync(dir).sort()) {
    const walk = (x) => fs.readdirSync(x, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(x, e.name)) : [path.join(x, e.name)]));
    for (const f of walk(path.join(dir, d))) console.log(`${d}  ${path.relative(path.join(dir, d), f)}`);
  }
} else die("unknown command " + cmd);
