/*
  Zero-dependency headless browser smoke test for the portfolio's interactive walks:
  - /?streettest (2D playable street on the home page)
  - /walk?walktest (3D seafront walk: framing, first-screen pole whirl hook, keyboard exit)
*/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = 4322;
const CDP_PORT = 9224;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`No Chrome/Chromium binary found (tried: ${candidates.join(', ')})`);
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          if (msg.error) p.reject(new Error(msg.error.message));
          else p.resolve(msg.result);
        }
      } else if (msg.method) {
        const list = this.events.get(msg.method);
        if (list) list.forEach((fn) => fn(msg.params));
      }
    });
  }
  on(method, fn) {
    if (!this.events.has(method)) this.events.set(method, []);
    this.events.get(method).push(fn);
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUrl(url, timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function openTab() {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' });
  const target = await res.json();
  const cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  const errors = [];
  cdp.on('Runtime.exceptionThrown', (p) => errors.push(`EXCEPTION: ${p.exceptionDetails?.text ?? 'unknown'}`));
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') errors.push(`CONSOLE_ERROR: ${p.args?.map((a) => a.value ?? a.description).join(' ')}`);
  });
  return { cdp, targetId: target.id, errors };
}

async function evalJs(cdp, expr) {
  const res = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) {
    throw new Error(`JS error: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description ?? ''}`);
  }
  return res.result?.value;
}

async function waitFor(cdp, expr, timeoutMs = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await evalJs(cdp, expr)) return;
    await sleep(150);
  }
  throw new Error(`Timeout waiting for: ${expr}`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(`SMOKE FAIL: ${msg}`);
}

const chromeBin = findChrome();
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'santtu-smoke-'));
const preview = spawn(
  process.execPath,
  ['node_modules/astro/bin/astro.mjs', 'preview', '--host', '127.0.0.1', '--port', String(PORT)],
  { stdio: 'ignore' },
);
let chrome = null;

try {
  await waitUrl(`${BASE_URL}/`);

  chrome = spawn(
    chromeBin,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profileDir}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  await waitUrl(`http://127.0.0.1:${CDP_PORT}/json/version`);

  // 1. Check 2D playable street via /?streettest
  {
    const { cdp, targetId, errors } = await openTab();
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `${BASE_URL}/?streettest` });
    await waitFor(cdp, 'Boolean(document.querySelector("[data-street].live") && window.__street && window.__street.goals)');
    await evalJs(cdp, 'window.__street.tick(4)');
    const streetInfo = await evalJs(cdp, `(() => {
      const s = window.__street;
      const cv = document.querySelector('[data-street] .stage canvas');
      const r = cv?.getBoundingClientRect();
      const coreKeys = document.querySelectorAll('[data-street] figcaption .keys:not(.extra-keys) > li').length;
      const moreClosed = document.querySelector('[data-street] figcaption details.more-keys')?.open === false;
      return { w: Math.round(r?.width ?? 0), h: Math.round(r?.height ?? 0), goals: Object.keys(s.goals).length, coreKeys, moreClosed };
    })()`);
    console.log('SMOKE_STREET:', streetInfo);
    assert(streetInfo.w > 200 && streetInfo.h > 200, '2D street canvas should render with non-zero size');
    assert(streetInfo.goals === 7, `2D street should expose 7 quest goals (got ${streetInfo.goals})`);
    assert(streetInfo.coreKeys === 3 && streetInfo.moreClosed, '2D street controls should start trimmed to 3 core actions');
    assert(errors.length === 0, `2D street console errors: ${errors.join('; ')}`);
    cdp.close();
    try { await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${targetId}`, { method: 'PUT' }); } catch {}
  }

  // 2. Check 3D walk via /walk?walktest at 800x600
  {
    const { cdp, targetId, errors } = await openTab();
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `${BASE_URL}/walk?walktest` });
    await waitFor(cdp, 'Boolean(window.__walk && window.__walk.goals)');
    await evalJs(cdp, 'window.__walk.tick(4)');
    const walkInfo = await evalJs(cdp, `(() => {
      const stage = document.querySelector('[data-walk-3d] .stage');
      const rect = stage.getBoundingClientRect();
      const w = window.__walk;
      const sd = w.level.start.dog;
      const nearPole = w.level.circles.some((c) => c.canWhirl && Math.hypot(c.x - sd.x, c.z - sd.z) < 4);
      return { stageBottom: Math.round(rect.bottom), firstGoal: w.goals[0]?.id, nearPole };
    })()`);
    console.log('SMOKE_WALK:', walkInfo);
    assert(walkInfo.stageBottom <= 600, `3D walk stage bottom (${walkInfo.stageBottom}) exceeds 600px`);
    assert(walkInfo.firstGoal === 'whirl', `Expected first goal 'whirl', got ${walkInfo.firstGoal}`);
    assert(walkInfo.nearPole, 'Expected whirl pole within 4m of spawn');
    assert(errors.length === 0, `3D walk console errors: ${errors.join('; ')}`);
    cdp.close();
    try { await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${targetId}`, { method: 'PUT' }); } catch {}
  }

  console.log('SMOKE_OK');
} finally {
  try { chrome?.kill('SIGKILL'); } catch {}
  try { preview.kill('SIGKILL'); } catch {}
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
}
