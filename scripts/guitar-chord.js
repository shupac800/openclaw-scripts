#!/usr/bin/env node
/**
 * Generate PNG chord diagram images for guitar triads using VexFlow.
 *
 * Uses Playwright to render an HTML page with VexFlow staff notation
 * and canvas-drawn tablature, then screenshots to PNG.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const TRIADS_PATH = path.join(__dirname, '..', 'sent_triads.json');
const STATIC_DIR = path.join(__dirname, 'static');
const TEMPLATE_PATH = path.join(__dirname, 'chord_template.html');
const KEY_SIGS_PATH = path.join(STATIC_DIR, 'key_signatures.json');

function filenameForTriad(triad) {
  const m = triad.name.match(/^(.+?) \(root fret (\d+), (\w) string\)$/);
  if (m) {
    const chord = m[1].replace(/ /g, '_').replace(/#/g, 's');
    return `${chord}_root${m[2]}_${m[3]}.png`;
  }
  return triad.name.replace(/ /g, '_') + '.png';
}

async function main() {
  const data = JSON.parse(fs.readFileSync(TRIADS_PATH, 'utf8'));
  const triads = data.available_triads;

  fs.mkdirSync(STATIC_DIR, { recursive: true });

  // Check which PNGs are missing
  const missing = triads.filter(t => {
    const pngPath = path.join(STATIC_DIR, filenameForTriad(t));
    return !fs.existsSync(pngPath);
  });

  if (missing.length === 0) {
    // console.log(`All ${triads.length} chord diagram PNGs are present.`);
  } else {

  console.log(`${missing.length} of ${triads.length} chord diagrams missing — regenerating...`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Load template
  const templateUrl = 'file:///' + TEMPLATE_PATH.replace(/\\/g, '/');
  await page.goto(templateUrl, { waitUntil: 'networkidle' });

  // Pass key signatures data to the page
  const keySigs = JSON.parse(fs.readFileSync(KEY_SIGS_PATH, 'utf8'));
  await page.evaluate((ks) => {
    window.__keySignatures = ks.keySignatures;
    window.__enharmonicNormalization = ks.enharmonicNormalization || {};
  }, keySigs);

  for (let i = 0; i < missing.length; i++) {
    const triad = missing[i];
    const outPath = path.join(STATIC_DIR, filenameForTriad(triad));

    try {
      // Reset and render
      await page.evaluate((t) => {
        window.__diagramReady = false;
        window.renderDiagram(t);
      }, triad);

      // Wait for SVG→canvas compositing
      await page.waitForFunction(() => window.__diagramReady === true, { timeout: 5000 });

      // Screenshot the canvas element
      const canvas = await page.$('canvas');
      if (canvas) {
        await canvas.screenshot({ path: outPath, type: 'png' });
      }
    } catch (e) {
      console.error(`  FAILED: ${triad.name}: ${e.message}`);
      continue;
    }

    if ((i + 1) % 20 === 0 || i === missing.length - 1) {
      console.log(`  ${i + 1}/${missing.length} done`);
    }
  }

    await browser.close();
    console.log(`Regenerated ${missing.length} diagrams in ${STATIC_DIR}`);
  }

  resetSentIfAllSent(data);
  pickUnsent(data);

  fs.writeFileSync(TRIADS_PATH, JSON.stringify(data, null, 2) + '\n');
}

function resetSentIfAllSent(data) {
  const allNames = new Set(data.available_triads.map(t => t.name));
  const allSent = data.sent_triads.length >= allNames.size &&
    data.sent_triads.every(name => allNames.has(name));
  if (allSent) {
    data.sent_triads = [];
    console.log('All triads have been sent — cleared sent list.');
  }
}

function pickUnsent(data) {
  const sentSet = new Set(data.sent_triads);
  const unsent = data.available_triads.filter(t => !sentSet.has(t.name));
  if (unsent.length === 0) {
    console.error('No unsent triads available.');
    process.exit(1);
  }
  const pick = unsent[Math.floor(Math.random() * unsent.length)];
  data.sent_triads.push(pick.name);
  const pngPath = path.join(STATIC_DIR, filenameForTriad(pick));
  console.log(pngPath);
}

main().catch(e => { console.error(e); process.exit(1); });
