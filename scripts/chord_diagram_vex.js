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

  console.log(`Generating ${triads.length} chord diagrams...`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Load template
  const templateUrl = 'file:///' + TEMPLATE_PATH.replace(/\\/g, '/');
  await page.goto(templateUrl, { waitUntil: 'networkidle' });

  for (let i = 0; i < triads.length; i++) {
    const triad = triads[i];
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

    if ((i + 1) % 20 === 0 || i === triads.length - 1) {
      console.log(`  ${i + 1}/${triads.length} done`);
    }
  }

  await browser.close();
  console.log(`All diagrams saved to ${STATIC_DIR}`);
}

main().catch(e => { console.error(e); process.exit(1); });
