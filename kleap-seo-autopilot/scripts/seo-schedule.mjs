#!/usr/bin/env node
// kleap-seo-autopilot / seo-schedule.mjs — prints the ONE schedule line for your agent, with absolute paths, so it also works under cron / launchd.
//
//   node seo-schedule.mjs <claude|codex|grok|openclaw|hermes> [--time "7 7 * * *"] [--sites ~/.kleap-seo/sites.txt] [--launchd]
//
// Why it exists: cron starts with an almost empty PATH, so `claude`, `grok`, `node` and `npx` are "not found" and the job fails silently into a log nobody reads.
// This prints the line with the real binary paths of THIS machine, keeps the key out of the crontab (it lives in a mode-600 env file), and writes each
// run's owner report to a dated file. It prints; it installs nothing and writes nothing.
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const [agent, ...rest] = process.argv.slice(2);
const opt = (n, d) => (rest.includes(n) ? rest[rest.indexOf(n) + 1] : d);
const AGENTS = {
  claude: (sentence) => ({ bin: "claude", args: `-p "${sentence}" --permission-mode acceptEdits --allowedTools "Bash" --max-turns 60` }),
  codex: (sentence) => ({ bin: "codex", args: `exec --full-auto "${sentence}"` }),
  grok: (sentence) => ({ bin: "grok", args: `-p "${sentence}" --always-approve --max-turns 40` }),
  openclaw: null, hermes: null,
};
if (!agent || !(agent in AGENTS)) { console.error("usage: node seo-schedule.mjs <claude|codex|grok|openclaw|hermes> [--time \"7 7 * * *\"] [--sites FILE] [--launchd]"); process.exit(2); }
const which = (b) => { try { return execFileSync("which", [b], { encoding: "utf8" }).trim(); } catch { return null; } };
const HOME = os.homedir();
const SEO = path.join(HOME, ".kleap-seo");
const time = opt("--time", "7 7 * * *");
const sites = opt("--sites", path.join(SEO, "sites.txt"));
const sentence = `Use the kleap-seo-autopilot skill: run its autopilot for the sites in ${sites}, then give me the owner report. On Mondays also give the weekly report and one growth idea. If nothing changed, answer in one line.`;

const node = which("node"), npx = which("npx");
if (!node || !npx) { console.error("node / npx not found on this machine: install Node 18+ first (https://nodejs.org)"); process.exit(1); }
console.log(`# 1. once: a key file that only you can read (never put the key in the crontab line or in a chat)`);
console.log(`mkdir -p ${SEO}/reports && install -m 600 /dev/null ${SEO}/env && echo 'export KLEAP_API_KEY=kleap_live_sk_...' >> ${SEO}/env   # Full-preset key from https://kleap.co/settings/api-key, for the account whose sites it may edit`);
console.log(`# 2. once, optional but faster and offline-safe: install the pinned CLI so every run does not go through npx`);
console.log(`npm i -g kleap-cli@2.1.0   # then add  export KLEAP_BIN=kleap  to ${SEO}/env`);
console.log(`# 3. the sites, one per line (never "all apps of the account")`);
console.log(`printf '%s\\n' my-site.kleap.io >> ${sites}`);

if (agent === "openclaw") {
  console.log(`# 4. OpenClaw has its own scheduler (checked against OpenClaw 2026.4.15 --help): no PATH problem, the report is announced to your chat`);
  console.log(`openclaw cron add --name "Kleap SEO autopilot" --cron "${time}" --session isolated --announce --timeout-seconds 1800 --message "${sentence}"`);
  process.exit(0);
}
if (agent === "hermes") {
  console.log(`# 4. Hermes Agent has its own scheduler: see prompts/openclaw-hermes.md (syntax from its docs; not run by us)`);
  process.exit(0);
}
const a = AGENTS[agent](sentence);
const bin = which(a.bin);
if (!bin) { console.error(`${a.bin} not found on this machine: is ${agent} installed and on PATH in THIS shell?`); process.exit(1); }
const PATHV = [...new Set([path.dirname(bin), path.dirname(node), path.dirname(npx), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"])].join(":");
const report = `${SEO}/reports/$(date +%F).md`;
if (rest.includes("--launchd")) {
  const label = "co.kleap.seo-autopilot";
  const [m, h] = time.split(/\s+/);
  console.log(`# 4. macOS launchd (more reliable than cron on a Mac): save as ~/Library/LaunchAgents/${label}.plist, then  launchctl load ~/Library/LaunchAgents/${label}.plist`);
  console.log(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>-lc</string>
    <string>export PATH=${PATHV}; . ${SEO}/env; ${bin} ${a.args.replace(/&/g, "&amp;")} &gt; ${report} 2&gt;&amp;1</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>${Number(h)}</integer><key>Minute</key><integer>${Number(m)}</integer></dict>
</dict></plist>`);
} else {
  console.log(`# 4. crontab -e  (the report of each run lands in ${SEO}/reports/<date>.md; open it, or have your agent send it to you)`);
  console.log(`${time} PATH=${PATHV} /bin/bash -c '. ${SEO}/env; ${bin} ${a.args} > ${report.replace(/%/g, "\\%")} 2>&1'`.replace(/\\\\%/g, "\\%"));
}
console.log(`# Check it ran: a missing report file two days in a row means the schedule stopped. \`node scripts/seo-log.mjs weekly\` also warns about it.`);
