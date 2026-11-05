#!/usr/bin/env node
// Renders the built site in a real browser and fails on the kinds of breakage
// that a clean `pnpm build` does not catch — both have happened on this site:
//   · content that renders but is invisible (the catalog once sat at opacity 0
//     because a reveal-on-scroll observer could never fire)
//   · layouts that overflow sideways on a phone (the header once made every
//     page 478px wide at 390px)
// plus a missing stylesheet, page errors, and an empty catalog or rankings.
//
//   pnpm build && pnpm check:render            # every page
//   pnpm build && pnpm check:render --quick    # 3 model pages, for iterating
//
// Exit codes: 0 = all checks passed · 1 = a rendering check failed ·
// 2 = could not run (no browser, or the server would not start).
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function cannotRun(msg) {
  console.error(`check-rendering: could not run — ${msg}`);
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  cannotRun("playwright-core is not installed (run pnpm install)");
}

const browserPath =
  process.env.CHROMIUM_PATH ||
  [path.join(process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers", "chromium")].find(existsSync);
if (!browserPath) cannotRun("no Chromium found; set CHROMIUM_PATH");
if (!existsSync(path.join(ROOT, ".next", "BUILD_ID"))) cannotRun("no production build; run pnpm build first");

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

// Start our OWN server on a free port, in its own process group, so it can't
// collide with — or be confused for — a server left running by anything else.
const port = await freePort();
const BASE = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [path.join(ROOT, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(port), "-H", "127.0.0.1"],
  { cwd: ROOT, detached: true, stdio: ["ignore", "pipe", "pipe"] },
);
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));
const stopServer = () => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
};
process.on("exit", stopServer);

const deadline = Date.now() + 30_000;
for (;;) {
  try {
    const r = await fetch(BASE + "/");
    if (r.ok) break;
  } catch {}
  if (server.exitCode !== null || Date.now() > deadline) {
    cannotRun(`server did not start on port ${port}\n${serverLog.slice(-800)}`);
  }
  await new Promise((r) => setTimeout(r, 300));
}

const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);

const browser = await chromium.launch({ executablePath: browserPath });

async function visit(urlPath, viewport) {
  const page = await browser.newPage({ viewport, isMobile: viewport.width < 768 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const where = `${urlPath} @${viewport.width}px`;
  const res = await page.goto(BASE + urlPath, { waitUntil: "networkidle" });
  if (!res || !res.ok()) fail(where, `HTTP ${res?.status()}`);
  // Bring each scroll-revealed block into view and give it a moment, the way a
  // reader reaching it would. Racing a scripted scroll past at full speed is NOT
  // a fair test: headless Chromium may never report the intersection, so a
  // working page would look broken. The block must then be visible — this is
  // exactly where the old catalog bug showed: fully on screen, still opacity 0.
  await page.waitForTimeout(500);
  const hidden = [];
  for (const el of await page.$$(".reveal")) {
    await el.evaluate((n) => n.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(700);
    const [opacity, label] = await el.evaluate((n) => [
      Number(getComputedStyle(n).opacity),
      n.id || n.tagName.toLowerCase(),
    ]);
    if (opacity < 0.5) hidden.push(label);
  }
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const rules = [...document.styleSheets].reduce((n, s) => {
      try {
        return n + s.cssRules.length;
      } catch {
        return n;
      }
    }, 0);
    return { overflow: de.scrollWidth - de.clientWidth, rules };
  });
  if (m.rules === 0) fail(where, "no CSS rules loaded — the stylesheet is missing");
  if (m.overflow > 1) fail(where, `page is ${m.overflow}px wider than the screen (horizontal scroll)`);
  if (hidden.length) fail(where, `content still invisible after scrolling to it: ${hidden.join(", ")}`);
  if (errors.length) fail(where, `page error: ${errors[0]}`);
  return { page, where };
}

const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };

for (const vp of [DESKTOP, PHONE]) {
  // Home: the catalog must actually show model cards.
  const home = await visit("/", vp);
  const cards = await home.page.$$eval('#catalog a[href^="/models/"]', (as) =>
    as.filter((a) => {
      const r = a.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).length,
  );
  if (cards === 0) fail(home.where, "the catalog shows no model cards");
  await home.page.close();

  // Benchmarks: rankings must exist and name a leader.
  const bench = await visit("/benchmarks", vp);
  const best = await bench.page.locator("text=★ Best").count();
  if (best === 0) fail(bench.where, "no benchmark ranking shows a ★ Best");
  await bench.page.close();

  for (const p of ["/compare", "/tools"]) await (await visit(p, vp)).page.close();
}

// Every model page, on a phone — the narrowest layout is where overflow shows.
// `--quick` samples three model pages instead of all of them (for iterating).
const allSlugs = readdirSync(path.join(ROOT, "content", "models"))
  .filter((f) => f.endsWith(".mdx"))
  .map((f) => f.replace(/\.mdx$/, ""));
const slugs = process.argv.includes("--quick") ? allSlugs.slice(0, 3) : allSlugs;
for (const slug of slugs) await (await visit(`/models/${slug}`, PHONE)).page.close();

await browser.close();
stopServer();

const pages = 2 * 4 + slugs.length;
if (failures.length) {
  console.error(`check-rendering: ${failures.length} problem(s) across ${pages} page views:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`check-rendering: all checks passed (${pages} page views, desktop and 390px phone).`);
process.exit(0);
