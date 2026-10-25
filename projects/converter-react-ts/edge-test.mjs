import puppeteer from 'puppeteer-core';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
(async () => {
  const b = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const p = await b.newPage();
  await p.goto('data:text/html,<h1>ok</h1>');
  const h1 = await p.evaluate(() => document.querySelector('h1').textContent);
  console.log('title:', h1);
  await b.close();
})();
