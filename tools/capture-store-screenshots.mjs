// Capture exact-resolution App Store screenshots from the real game render.
//
// Why: the game is responsive, so rendering it at each device's pixel size
// produces native screenshots (sharper than upscaling a screen recording),
// and lets us cover iPad — which a phone-shaped capture cannot.
//
// Prereqs (run once, on Windows):
//   npm i -D puppeteer        // downloads its own Chromium, no system Chrome needed
//   npm run build:mobile      // make sure dist/ holds the current build
//
// Run:
//   node tools/capture-store-screenshots.mjs
//
// Output: markting/appstore/<device>/cap_<scene>.png
//
// How it drives the game: the script sets window.__CAPTURE__ before load, which
// makes index.ts expose window.__sq = { coordinator, STAGES }. We seed progress
// via localStorage ("nge_maxCompleted") and then call the coordinator's public
// navigation methods to reach each scene. No manual play / no real save needed.

import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'markting', 'appstore');

// App Store required portrait sizes (exact pixels, no alpha).
const DEVICES = [
  { name: 'iphone_6.9', width: 1290, height: 2796 }, // 6.9"/6.7" iPhone slot
  { name: 'ipad_13', width: 2064, height: 2752 },    // 13" iPad Pro (required, app is Universal)
];

// The five wanted scenes. `seed` is the maxCompleted value to inject before
// boot (unlocks levels / decides lobby visibility); `nav` is the in-page driver.
const SCENARIOS = [
  { id: 'stage1', seed: 0,  nav: null },                               // fresh -> auto-enters Stage 1
  { id: 'stage3', seed: 2,  nav: 'sq.coordinator.showGame(sq.STAGES[2])' },
  { id: 'daily',  seed: 19, nav: 'sq.coordinator.showDailyChallenge()' },
  { id: 'lobby',  seed: 19, nav: 'sq.coordinator.showLobby()' },
  { id: 'win',    seed: 2,  nav: 'sq.coordinator.showGame(sq.STAGES[2]); await wait(900); sq.coordinator.showWinOverlay(3)' },
];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.css': 'text/css',
  '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function startServer(dir) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        let p = decodeURIComponent(req.url.split('?')[0]);
        if (p === '/') p = '/index.html';
        let fp = path.join(dir, p);
        if (!existsSync(fp)) fp = path.join(ROOT, p); // assets served from src/assets in dev
        const data = await readFile(fp);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404); res.end('not found');
      }
    });
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.error('dist/index.html missing — run "npm run build:mobile" first.');
    process.exit(1);
  }
  const { server, port } = await startServer(DIST);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  });

  for (const dev of DEVICES) {
    const dir = path.join(OUT, dev.name);
    await mkdir(dir, { recursive: true });
    for (const sc of SCENARIOS) {
      const page = await browser.newPage();
      await page.setViewport({ width: dev.width, height: dev.height, deviceScaleFactor: 1 });
      // Enable the capture hook + seed progress before any game script runs.
      await page.evaluateOnNewDocument((mc) => {
        window.__CAPTURE__ = true;
        try { localStorage.setItem('nge_maxCompleted', String(mc)); } catch {}
      }, sc.seed);
      // 'load' (not networkidle0): the looping bg-music stream keeps the network
      // busy, so networkidle never settles.
      await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load', timeout: 60000 });
      // Wait for the splash to finish and the hook to appear, then navigate.
      await page.waitForFunction(() => !!window.__sq, { timeout: 30000 });
      await sleep(600); // let the initial scene settle
      if (sc.nav) {
        await page.evaluate(async (navCode) => {
          const sq = window.__sq;
          const wait = (ms) => new Promise((r) => setTimeout(r, ms));
          // eslint-disable-next-line no-eval
          await eval(`(async () => { ${navCode}; })()`);
        }, sc.nav);
      }
      await sleep(1200); // let the scene transition / overlay settle before the shot
      const file = path.join(dir, `cap_${sc.id}.png`);
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: dev.width, height: dev.height } });
      console.log('saved', file);
      await page.close();
    }
  }

  await browser.close();
  server.close();
  console.log('done');
})();
