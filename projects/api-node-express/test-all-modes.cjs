const sharp = require('sharp');
const FormData = require('form-data');
const http = require('http');

const BASE_URL = 'http://localhost:3000';
const MODES = [
  { name: 'glyph',  path: '/process/glyph',  config: { cols: 60, glow: 15, charset: 1 }, expectPNG: true },
  { name: 'pixel',  path: '/process/pixel',  config: { palette: 'pico8', block: 8 }, expectPNG: true },
  { name: 'glitch', path: '/process/glitch', config: { amt: 50 }, expectPNG: true },
  { name: 'palette', path: '/process/palette', config: { colors: 16 }, expectPNG: true },
  { name: 'histogram', path: '/process/histogram', config: {}, expectPNG: true },
  { name: 'ascii',  path: '/ascii', config: { cols: 60 }, expectTEXT: true },
];

function request(path, form) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3000, path, method: 'POST', headers: form.getHeaders() };
    const req = http.request(opts, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    form.pipe(req);
  });
}

async function run() {
  // create test image once
  const imgBuf = await sharp({
    create: { width: 200, height: 150, channels: 4, background: '#39ff14' }
  }).png().toBuffer();

  console.log('Testing all modes against', BASE_URL);
  let passed = 0, failed = 0;

  for (const mode of MODES) {
    const form = new FormData();
    form.append('image', imgBuf, { filename: 'test.png', contentType: 'image/png' });
    form.append('config', JSON.stringify(mode.config));

    try {
      const res = await request(mode.path, form);
      if (res.status !== 200) {
        console.log(`  FAIL ${mode.name}: status ${res.status} - ${res.data.toString().substring(0,120)}`);
        failed++;
        continue;
      }
      if (mode.expectPNG) {
        const isPNG = res.data[0] === 0x89 && res.data[1] === 0x50; // PNG magic
        if (!isPNG) {
          console.log(`  FAIL ${mode.name}: expected PNG, got ${res.data.toString().substring(0,60)}`);
          failed++;
          continue;
        }
        console.log(`  PASS ${mode.name}: ${res.data.length} bytes PNG`);
      } else if (mode.expectTEXT) {
        const text = res.data.toString();
        const hasText = text.includes('text') || text.includes('░') || text.includes('▒') || text.includes('█');
        if (!hasText) {
          console.log(`  FAIL ${mode.name}: unexpected text response: ${text.substring(0,120)}`);
          failed++;
          continue;
        }
        console.log(`  PASS ${mode.name}: text response valid`);
      }
      passed++;
    } catch (err) {
      console.log(`  FAIL ${mode.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${passed}/${MODES.length} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
