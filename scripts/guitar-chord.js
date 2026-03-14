#!/usr/bin/env node
/**
 * Chord family triad trainer.
 *
 * Each day a "family" is chosen:
 *   - major-aug:  all Major + Augmented voicings for a root (e.g. "F major-aug")
 *   - minor-dim:  all Minor + Diminished voicings for a root (e.g. "F minor-dim")
 *
 * Selection process:
 *   1. Pick a random triad from all available whose family has NOT been sent yet.
 *   2. That determines today's family.
 *   3. All subsequent sends that day come from the same family.
 *   4. At the start of a new day, yesterday's family is archived as sent.
 *   5. When all 24 families are sent, the cycle resets.
 */

const fs   = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const TRIADS_PATH   = path.join(__dirname, '..', 'sent_triads.json');
const STATIC_DIR    = path.join(__dirname, 'static');
const TEMPLATE_PATH = path.join(__dirname, 'chord_template.html');
const KEY_SIGS_PATH = path.join(STATIC_DIR, 'key_signatures.json');

let enharmonicNorm = {};

// ── helpers ──────────────────────────────────────────────────────────────────

function normalizeTriad(triad) {
  const m = triad.name.match(/^(.+?)\s+(Major|Minor|Diminished|Augmented)\s+(\(.+\))$/);
  if (!m) return triad;
  const [, root, quality, rest] = m;
  const qualityWord = quality === 'Augmented' ? 'major'
    : quality === 'Diminished' ? 'minor'
    : quality.toLowerCase();
  const mapped = enharmonicNorm[`${root} ${qualityWord}`];
  if (!mapped) return triad;
  const newRoot = mapped.split(' ')[0];
  return { ...triad, root: newRoot, name: `${newRoot} ${quality} ${rest}` };
}

function filenameForTriad(triad) {
  const norm = normalizeTriad(triad);
  const m = norm.name.match(/^(.+?) \(root fret (\d+), (\w) string\)$/);
  if (m) {
    const chord = m[1].replace(/ /g, '_').replace(/#/g, 's');
    return `${chord}_root${m[2]}_${m[3]}.png`;
  }
  return norm.name.replace(/ /g, '_') + '.png';
}

function getFamilyForTriad(triad) {
  const norm = normalizeTriad(triad);
  const m = norm.name.match(/^(.+?)\s+(Major|Minor|Diminished|Augmented)\s+/);
  if (!m) return null;
  const [, root, quality] = m;
  const group = (quality === 'Major' || quality === 'Augmented') ? 'major-aug' : 'minor-dim';
  return `${root} ${group}`;
}

function getTodayCT() {
  const s = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const [mm, dd, yyyy] = s.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── PNG generation ────────────────────────────────────────────────────────────

async function renderMissingPngs(missing) {
  console.error(`${missing.length} PNGs missing — regenerating...`);
  const keySigsData = JSON.parse(fs.readFileSync(KEY_SIGS_PATH, 'utf8'));
  const browser = await chromium.launch();
  const page    = await browser.newPage();
  await page.goto('file:///' + TEMPLATE_PATH.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.evaluate((ks) => {
    window.__keySignatures          = ks.keySignatures;
    window.__enharmonicNormalization = ks.enharmonicNormalization || {};
  }, keySigsData);

  for (const triad of missing) {
    const outPath = path.join(STATIC_DIR, filenameForTriad(triad));
    try {
      const normTriad = normalizeTriad(triad);
      await page.evaluate((t) => { window.__diagramReady = false; window.renderDiagram(t); }, normTriad);
      await page.waitForFunction(() => window.__diagramReady === true, { timeout: 5000 });
      const canvas = await page.$('canvas');
      if (canvas) await canvas.screenshot({ path: outPath, type: 'png' });
    } catch (e) {
      console.error(`  FAILED: ${triad.name}: ${e.message}`);
    }
  }
  await browser.close();
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const data = JSON.parse(fs.readFileSync(TRIADS_PATH, 'utf8'));

  const keySigsData = JSON.parse(fs.readFileSync(KEY_SIGS_PATH, 'utf8'));
  enharmonicNorm = keySigsData.enharmonicNormalization || {};

  if (!data.sent_families) data.sent_families = [];

  const today = getTodayCT();

  // ── advance day ────────────────────────────────────────────────────────────
  if (!data.current_day || data.current_day.date !== today) {

    // Archive yesterday's family
    if (data.current_day) {
      data.sent_families.push(data.current_day.family);
    }

    // Collect all families that exist in available_triads
    const allFamilies = new Set(
      data.available_triads.map(getFamilyForTriad).filter(Boolean)
    );

    // Reset cycle when all families have been sent
    const sentSet = new Set(data.sent_families);
    if ([...allFamilies].every(f => sentSet.has(f))) {
      data.sent_families = [];
      sentSet.clear();
    }

    // Pick first triad of the day: random from triads whose family is unsent
    const eligible = data.available_triads.filter(t => {
      const f = getFamilyForTriad(t);
      return f && !new Set(data.sent_families).has(f);
    });

    const firstPick  = pickRandom(eligible);
    const todayFamily = getFamilyForTriad(firstPick);

    data.current_day = { date: today, family: todayFamily, sent_triads: [] };
  }

  const todayFamily  = data.current_day.family;
  const familyTriads = data.available_triads.filter(t => getFamilyForTriad(t) === todayFamily);

  // Ensure PNGs exist for today's family
  fs.mkdirSync(STATIC_DIR, { recursive: true });
  const missing = familyTriads.filter(t => !fs.existsSync(path.join(STATIC_DIR, filenameForTriad(t))));
  if (missing.length > 0) await renderMissingPngs(missing);

  // Pick an unsent voicing for today; reset if all sent
  let unsent = familyTriads.filter(t => !data.current_day.sent_triads.includes(t.name));
  if (unsent.length === 0) {
    data.current_day.sent_triads = [];
    unsent = familyTriads;
  }

  const pick = pickRandom(unsent);
  data.current_day.sent_triads.push(pick.name);

  console.log(path.join(STATIC_DIR, filenameForTriad(pick)));

  // Clean up old fields from previous system
  delete data.chord_order;
  delete data.sent_chords;

  fs.writeFileSync(TRIADS_PATH, JSON.stringify(data, null, 2) + '\n');
}

main().catch(e => { console.error(e); process.exit(1); });
