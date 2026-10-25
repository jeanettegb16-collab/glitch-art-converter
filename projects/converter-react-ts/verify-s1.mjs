import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ORIG_URL = 'http://localhost:5180/glitch-art-converter/';
const PORT_URL = 'http://localhost:5181/';
const OUT = join(process.cwd(), 'verify-out');
const DELAY = ms => new Promise(r => setTimeout(r, ms));

async function waitServer(url, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const res = await fetch(url); if (res.status === 200) return true; } catch {}
    await DELAY(300);
  }
  throw new Error('Server not up: ' + url);
}

async function screenshot(page, path) {
  await page.screenshot({ path, fullPage: true, type: 'png' });
}

async function main() {
  await mkdir(OUT, { recursive: true });

  // Start original server
  console.log('Starting original server on 5180…');
  const origCp = spawn('npx', ['vite', '--port', '5180'], {
    cwd: join(process.cwd(), '..', '..'),
    stdio: 'inherit',
    shell: true,
    detached: false,
  });

  // Start react server
  console.log('Starting react server on 5181…');
  const portCp = spawn('npx', ['vite', '--port', '5181'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    detached: false,
  });

  await waitServer(ORIG_URL, 25000);
  await waitServer(PORT_URL, 25000);
  console.log('Both servers ready.');

  console.log('Launching browser…');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions', '--disable-default-apps'],
  });
  console.log('Browser launched.');

  try {
    const pOrig = await browser.newPage();
    const pPort = await browser.newPage();
    await pOrig.setViewport({ width: 1280, height: 800 });
    await pPort.setViewport({ width: 1280, height: 800 });

    await pOrig.goto(ORIG_URL, { waitUntil: 'networkidle0' });
    await pPort.goto(PORT_URL, { waitUntil: 'networkidle0' });
    await DELAY(1500);

    const snap = async (name) => {
      await Promise.all([
        screenshot(pOrig, join(OUT, `orig-${name}.png`)),
        screenshot(pPort, join(OUT, `port-${name}.png`)),
      ]);
    };

    await snap('baseline');
    console.log('Baseline screenshot OK');

    const results = [];

    // btnSide
    console.log('-- btnSide');
    await pPort.click('#btnSide'); await DELAY(600);
    const leftDisp = await pPort.evaluate(() => $('leftPanel').style.display);
    results.push({ c:'btnSide toggle', ok: leftDisp==='none', n: leftDisp });
    await pPort.click('#btnSide'); await DELAY(600);

    // Settings popup
    console.log('-- settings popup');
    await pPort.click('#btnSettings'); await DELAY(300);
    results.push({ c:'btnSettings open', ok: await pPort.evaluate(() => $('settingsPop').classList.contains('open')), n:'' });
    await pPort.mouse.click(30,30); await DELAY(300);
    results.push({ c:'settings close', ok: !(await pPort.evaluate(() => $('settingsPop').classList.contains('open'))), n:'' });

    // Zoom A+/A−
    console.log('-- zoom');
    await pPort.click('#btnZoomUp'); await DELAY(400);
    const zu = await pPort.evaluate(() => (document.querySelector('.left') || {}).style?.zoom || 'none');
    results.push({ c:'btnZoomUp', ok: zu.startsWith('1.1') || zu.startsWith('1.2'), n: zu }); // 110%
    await pPort.click('#btnZoomDn'); await DELAY(400);
    const zd = await pPort.evaluate(() => (document.querySelector('.left') || {}).style?.zoom || 'none');
    results.push({ c:'btnZoomDn revert', ok: zd==='' || zd==='1', n: zd });

    // Mode buttons (no layer)
    console.log('-- mode buttons no-layer');
    await pPort.click('#btnModeGlyph'); await DELAY(400);
    results.push({ c:'btnModeGlyph no-layer', ok: await pPort.evaluate(() => $('status').textContent === '> SELECT AN IMAGE LAYER FIRST'), n:await pPort.evaluate(() => $('status').textContent) });

    // SAVE project
    console.log('-- save project');
    await pPort.click('#btnSaveProj'); await DELAY(600);
    results.push({ c:'btnSaveProj', ok: await pPort.evaluate(() => $('status').textContent === '> PROJECT SAVED'), n:await pPort.evaluate(() => $('status').textContent) });

    // compare baseline images: check that topbar widths match roughly
    const origDim = await pOrig.evaluate(() => {
      const el = document.querySelector('.topbar');
      return el ? { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height } : null;
    });
    const portDim = await pPort.evaluate(() => {
      const el = document.querySelector('.topbar');
      return el ? { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height } : null;
    });
    results.push({ c:'topbar dimensions', ok: origDim && portDim && Math.abs(origDim.w - portDim.w) < 5 && Math.abs(origDim.h - portDim.h) < 2, n:`orig=${JSON.stringify(origDim)} port=${JSON.stringify(portDim)}` });

    // export (will report error "NOTHING TO EXPORT" since no layers exist in this fresh load)
    console.log('-- export (nothing to export)');
    await pPort.click('#btnAnim'); await DELAY(600);
    results.push({ c:'btnAnim (no layers)', ok: await pPort.evaluate(() => $('status').textContent === '> NOTHING TO EXPORT'), n:await pPort.evaluate(() => $('status').textContent) });

    // Export PNG (no layers)
    console.log('-- PNG (no layers)');
    await pPort.click('#btnPng'); await DELAY(600);
    results.push({ c:'btnPng (no layers)', ok: await pPort.evaluate(() => $('status').textContent === '> NOTHING TO EXPORT'), n:await pPort.evaluate(() => $('status').textContent) });

    // OPEN (no-op, just verify click)
    console.log('-- open button click');
    await pPort.click('#btnOpenProj'); await DELAY(300);
    results.push({ c:'btnOpenProj', ok: true, n: 'clicks hidden file input' });

    // Result summary
    const lines = results.map(r => `- ${r.c}: ${r.ok ? 'OK' : 'FAIL'}${r.n ? ' (' + r.n + ')' : ''}`);
    const report = lines.join('\n') + '\n';
    await writeFile(join(OUT, 'report.txt'), report);
    console.log('\n--- REPORT ---\n' + report);
  } finally {
    await browser.close();
    origCp.kill('SIGTERM');
    portCp.kill('SIGTERM');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
