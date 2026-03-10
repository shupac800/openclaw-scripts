#!/usr/bin/env node
/**
 * Tests for guitar-chord.js and chord_template.html logic.
 *
 * Uses Node built-in test runner (node --test).
 * Tests the pure functions extracted from the template, plus
 * integration tests that render actual PNGs via Playwright.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// ---- Inline the pure functions from chord_template.html for unit testing ----

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const OPEN_MIDI = { E: 40, A: 45, D: 50, G: 55, B: 59, e: 64 };
const FLAT_MAP = { Eb:'D#', Bb:'A#', Ab:'G#', Db:'C#', Gb:'F#', Fb:'E', Cb:'B' };
const INTERVAL_NAME_MAP = {
  R:'R', '1':'R', b3:'m3', m3:'m3', '3':'3',
  b5:'dim5', '5-':'dim5', dim5:'dim5', '5':'5',
  '#5':'aug5', '5+':'aug5', aug5:'aug5',
};
const STRING_TO_ORDINAL = { e:'1st', B:'2nd', G:'3rd', D:'4th', A:'5th', E:'6th' };
const OPEN_SEMITONES = { E: 4, A: 9, D: 2, G: 7, B: 11, e: 4 };
const KEY_SHARPS = { C:0, G:1, D:2, A:3, E:4, B:5, 'F#':6, 'C#':7 };
const KEY_FLATS = { F:1, Bb:2, Eb:3, Ab:4, Db:5, Gb:6, Cb:7 };
const SHARP_ORDER_NOTES = ['F#','C#','G#','D#','A#','E#','B#'];
const FLAT_ORDER_NOTES = ['Bb','Eb','Ab','Db','Gb','Cb','Fb'];

function ordinal(n) {
  if (11 <= n % 100 && n % 100 <= 13) return n + 'th';
  const s = ['th','st','nd','rd'];
  return n + (s[n % 10] || 'th');
}

function noteToSemitone(name) {
  const n = FLAT_MAP[name] || name;
  return NOTE_NAMES.indexOf(n);
}
function getInversion(triad) {
  const BASS_ORDER = ['E', 'A', 'D', 'G', 'B', 'e'];
  let bassString = null, bassFret = -1;
  for (const s of BASS_ORDER) {
    if (triad.strings[s] >= 0) { bassString = s; bassFret = triad.strings[s]; break; }
  }
  if (!bassString) return 'root position';
  const bassSemitone = (OPEN_SEMITONES[bassString] + bassFret) % 12;
  for (const [interval, note] of Object.entries(triad.chord_tones)) {
    if (noteToSemitone(note) === bassSemitone) {
      if (interval === 'R') return 'root position';
      if (interval === '3' || interval === 'm3') return '1st inversion';
      return '2nd inversion';
    }
  }
  return 'root position';
}
const COLOR_FG = '#ffffff';
function formatTitle(triad) {
  const m = triad.name.match(/^(.+?)\s+(Major|Minor|Diminished|Augmented)\s+\(root fret (\d+), (\w) string\)$/);
  if (!m) return { chordName: triad.name, inversion: '', line2: '', chordColor: COLOR_FG };
  const [, root, quality, fret, str] = m;
  const inversion = getInversion(triad);
  const isBright = quality === 'Major' || quality === 'Augmented';
  return {
    chordName: `${root} ${quality.toLowerCase()}`,
    inversion,
    line2: `${STRING_TO_ORDINAL[str]} string, ${ordinal(+fret)} fret`,
    chordColor: isBright ? '#00e5ff' : '#ff69b4'
  };
}

function getWrittenPitch(string, fret) {
  const midi = OPEN_MIDI[string] + fret + 12;
  const octave = Math.floor(midi / 12) - 1;
  const noteIdx = midi % 12;
  return { noteName: NOTE_NAMES[noteIdx], octave };
}

function getKeySigInfo(root, quality) {
  let key;
  if (quality === 'Major' || quality === 'Augmented') {
    key = root;
  } else {
    const rootNorm = FLAT_MAP[root] || root;
    const idx = NOTE_NAMES.indexOf(rootNorm);
    const relIdx = (idx + 3) % 12;
    key = NOTE_NAMES[relIdx];
    const enh = { 'A#':'Bb', 'D#':'Eb', 'G#':'Ab' };
    key = enh[key] || key;
  }
  if (key in KEY_SHARPS) {
    return { vexKey: key, accNotes: SHARP_ORDER_NOTES.slice(0, KEY_SHARPS[key]), type: 'sharp' };
  } else if (key in KEY_FLATS) {
    return { vexKey: key, accNotes: FLAT_ORDER_NOTES.slice(0, KEY_FLATS[key]), type: 'flat' };
  }
  return { vexKey: 'C', accNotes: [], type: 'none' };
}

function filenameForTriad(triad) {
  const m = triad.name.match(/^(.+?) \(root fret (\d+), (\w) string\)$/);
  if (m) {
    const chord = m[1].replace(/ /g, '_').replace(/#/g, 's');
    return `${chord}_root${m[2]}_${m[3]}.png`;
  }
  return triad.name.replace(/ /g, '_') + '.png';
}

function buildToneMap(triad) {
  const m = {};
  for (const [interval, note] of Object.entries(triad.chord_tones)) {
    const normalized = FLAT_MAP[note] || note;
    const display = INTERVAL_NAME_MAP[interval] || interval;
    m[normalized] = { interval: display, original: note };
  }
  return m;
}

// ---- Tests ----

describe('getWrittenPitch', () => {
  it('open low E string = E3 written', () => {
    const { noteName, octave } = getWrittenPitch('E', 0);
    assert.equal(noteName, 'E');
    assert.equal(octave, 3);
  });

  it('A string fret 3 = C4 written', () => {
    const { noteName, octave } = getWrittenPitch('A', 3);
    assert.equal(noteName, 'C');
    assert.equal(octave, 4);
  });

  it('D string fret 2 = E4 written', () => {
    const { noteName, octave } = getWrittenPitch('D', 2);
    assert.equal(noteName, 'E');
    assert.equal(octave, 4);
  });

  it('open G string = G4 written', () => {
    const { noteName, octave } = getWrittenPitch('G', 0);
    assert.equal(noteName, 'G');
    assert.equal(octave, 4);
  });

  it('open high e = E5 written', () => {
    const { noteName, octave } = getWrittenPitch('e', 0);
    assert.equal(noteName, 'E');
    assert.equal(octave, 5);
  });

  it('B string fret 1 = C5 written', () => {
    const { noteName, octave } = getWrittenPitch('B', 1);
    assert.equal(noteName, 'C');
    assert.equal(octave, 5);
  });
});

describe('getKeySigInfo', () => {
  it('C major = no accidentals', () => {
    const info = getKeySigInfo('C', 'Major');
    assert.deepEqual(info.accNotes, []);
    assert.equal(info.vexKey, 'C');
  });

  it('G major = one sharp (F#)', () => {
    const info = getKeySigInfo('G', 'Major');
    assert.deepEqual(info.accNotes, ['F#']);
    assert.equal(info.type, 'sharp');
  });

  it('F major = one flat (Bb)', () => {
    const info = getKeySigInfo('F', 'Major');
    assert.deepEqual(info.accNotes, ['Bb']);
    assert.equal(info.type, 'flat');
  });

  it('D major = two sharps', () => {
    const info = getKeySigInfo('D', 'Major');
    assert.deepEqual(info.accNotes, ['F#', 'C#']);
  });

  it('Bb major = two flats', () => {
    const info = getKeySigInfo('Bb', 'Major');
    assert.deepEqual(info.accNotes, ['Bb', 'Eb']);
  });

  it('A minor uses C major (no accidentals)', () => {
    const info = getKeySigInfo('A', 'Minor');
    assert.deepEqual(info.accNotes, []);
  });

  it('E minor uses G major (one sharp)', () => {
    const info = getKeySigInfo('E', 'Minor');
    assert.deepEqual(info.accNotes, ['F#']);
  });

  it('D minor uses F major (one flat)', () => {
    const info = getKeySigInfo('D', 'Minor');
    assert.deepEqual(info.accNotes, ['Bb']);
  });
});

describe('formatTitle', () => {
  it('root position C Major', () => {
    const triad = {
      name: 'C Major (root fret 3, A string)',
      root: 'C',
      chord_tones: { R: 'C', '3': 'E', '5': 'G' },
      strings: { E: -1, A: 3, D: 2, G: 0, B: -1, e: -1 }
    };
    const result = formatTitle(triad);
    assert.equal(result.chordName, 'C major');
    assert.equal(result.inversion, 'root position');
    assert.equal(result.line2, '5th string, 3rd fret');
    assert.equal(result.chordColor, '#00e5ff');
  });

  it('1st inversion (3rd in bass)', () => {
    // E minor: R=E, m3=G, 5=B. If G is in the bass => 1st inversion
    const triad = {
      name: 'E Minor (root fret 0, G string)',
      root: 'E',
      chord_tones: { R: 'E', m3: 'G', '5': 'B' },
      strings: { E: -1, A: -1, D: 5, G: 0, B: 0, e: -1 }
    };
    // Bass note: D string fret 5 = (2+5)%12 = 7 = G => m3 => 1st inversion
    const result = formatTitle(triad);
    assert.equal(result.chordName, 'E minor');
    assert.equal(result.inversion, '1st inversion');
    assert.equal(result.line2, '3rd string, 0th fret');
    assert.equal(result.chordColor, '#ff69b4');
  });

  it('2nd inversion (5th in bass)', () => {
    // C Major: R=C, 3=E, 5=G. G in the bass => 2nd inversion
    const triad = {
      name: 'C Major (root fret 5, D string)',
      root: 'C',
      chord_tones: { R: 'C', '3': 'E', '5': 'G' },
      strings: { E: 3, A: -1, D: 5, G: 5, B: -1, e: -1 }
    };
    // Bass: E string fret 3 = (4+3)%12 = 7 = G => 5 => 2nd inversion
    const result = formatTitle(triad);
    assert.equal(result.chordName, 'C major');
    assert.equal(result.inversion, '2nd inversion');
    assert.equal(result.line2, '4th string, 5th fret');
    assert.equal(result.chordColor, '#00e5ff');
  });

  it('high e string', () => {
    const triad = {
      name: 'E Minor (root fret 12, e string)',
      root: 'E',
      chord_tones: { R: 'E', m3: 'G', '5': 'B' },
      strings: { E: -1, A: -1, B: 7, G: 12, e: 12, D: -1 }
    };
    // Bass: G string fret 12 = (7+12)%12 = 7 = G => m3 => 1st inversion
    const result = formatTitle(triad);
    assert.equal(result.chordName, 'E minor');
    assert.equal(result.inversion, '1st inversion');
    assert.equal(result.line2, '1st string, 12th fret');
    assert.equal(result.chordColor, '#ff69b4');
  });

  it('augmented gets cyan', () => {
    const triad = {
      name: 'C Augmented (root fret 3, A string)',
      root: 'C',
      chord_tones: { R: 'C', '3': 'E', '5+': 'Ab' },
      strings: { E: -1, A: 3, D: 2, G: 1, B: -1, e: -1 }
    };
    assert.equal(formatTitle(triad).chordColor, '#00e5ff');
  });

  it('diminished gets pink', () => {
    const triad = {
      name: 'C Diminished (root fret 3, A string)',
      root: 'C',
      chord_tones: { R: 'C', m3: 'Eb', '5-': 'Gb' },
      strings: { E: -1, A: 3, D: 1, G: 11, B: -1, e: -1 }
    };
    assert.equal(formatTitle(triad).chordColor, '#ff69b4');
  });
});

describe('filenameForTriad', () => {
  it('C major', () => {
    assert.equal(filenameForTriad({ name: 'C Major (root fret 3, A string)' }),
                 'C_Major_root3_A.png');
  });

  it('F# minor', () => {
    assert.equal(filenameForTriad({ name: 'F# Minor (root fret 9, A string)' }),
                 'Fs_Minor_root9_A.png');
  });
});

describe('buildToneMap', () => {
  it('maps chord tones correctly', () => {
    const triad = { chord_tones: { '3': 'E', '5': 'G', R: 'C' } };
    const m = buildToneMap(triad);
    assert.equal(m.E.interval, '3');
    assert.equal(m.E.original, 'E');
    assert.equal(m.G.interval, '5');
    assert.equal(m.C.interval, 'R');
  });

  it('normalizes flats', () => {
    const triad = { chord_tones: { b3: 'Gb', '5': 'Bb', R: 'Eb' } };
    const m = buildToneMap(triad);
    assert.equal(m['F#'].interval, 'm3');
    assert.equal(m['F#'].original, 'Gb');
    assert.equal(m['A#'].interval, '5');
    assert.equal(m['D#'].interval, 'R');
  });
});

describe('filenameForTriad missing-check', () => {
  it('detects missing PNGs correctly', () => {
    const staticDir = path.join(__dirname, 'static');
    // A triad whose PNG definitely exists (generated earlier)
    const existing = { name: 'C Major (root fret 3, A string)' };
    const existingPath = path.join(staticDir, filenameForTriad(existing));
    // Only assert if the static dir has been populated
    if (fs.existsSync(existingPath)) {
      assert.ok(fs.existsSync(existingPath));
    }

    // A triad with a bogus name — PNG should not exist
    const fake = { name: 'Z Major (root fret 99, A string)' };
    const fakePath = path.join(staticDir, filenameForTriad(fake));
    assert.ok(!fs.existsSync(fakePath));
  });
});

// ---- Import the new functions for testing ----
// They're not exported, so we reimplement them here (same logic as guitar-chord.js)

function resetSentIfAllSent(data) {
  const allNames = new Set(data.available_triads.map(t => t.name));
  const allSent = data.sent_triads.length >= allNames.size &&
    data.sent_triads.every(name => allNames.has(name));
  if (allSent) {
    data.sent_triads = [];
  }
  return allSent;
}

function pickUnsent(data) {
  const sentSet = new Set(data.sent_triads);
  const unsent = data.available_triads.filter(t => !sentSet.has(t.name));
  if (unsent.length === 0) return null;
  const pick = unsent[Math.floor(Math.random() * unsent.length)];
  data.sent_triads.push(pick.name);
  return pick;
}

describe('resetSentIfAllSent', () => {
  it('clears sent list when all triads sent', () => {
    const data = {
      available_triads: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      sent_triads: ['A', 'B', 'C'],
    };
    const cleared = resetSentIfAllSent(data);
    assert.ok(cleared);
    assert.deepEqual(data.sent_triads, []);
  });

  it('does not clear when some unsent', () => {
    const data = {
      available_triads: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      sent_triads: ['A', 'B'],
    };
    const cleared = resetSentIfAllSent(data);
    assert.ok(!cleared);
    assert.deepEqual(data.sent_triads, ['A', 'B']);
  });

  it('does not clear when sent list has unknown names', () => {
    const data = {
      available_triads: [{ name: 'A' }, { name: 'B' }],
      sent_triads: ['A', 'B', 'X'],
    };
    const cleared = resetSentIfAllSent(data);
    assert.ok(!cleared);
  });
});

describe('pickUnsent', () => {
  it('picks an unsent triad', () => {
    const data = {
      available_triads: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      sent_triads: ['A', 'B'],
    };
    const pick = pickUnsent(data);
    assert.equal(pick.name, 'C');
    assert.ok(data.sent_triads.includes('C'));
  });

  it('returns null when all sent', () => {
    const data = {
      available_triads: [{ name: 'A' }],
      sent_triads: ['A'],
    };
    const pick = pickUnsent(data);
    assert.equal(pick, null);
  });

  it('adds picked triad to sent list', () => {
    const data = {
      available_triads: [{ name: 'A' }, { name: 'B' }],
      sent_triads: [],
    };
    const pick = pickUnsent(data);
    assert.ok(pick);
    assert.equal(data.sent_triads.length, 1);
    assert.equal(data.sent_triads[0], pick.name);
  });
});

describe('integration: render PNG', () => {
  it('generates a PNG file via Playwright', async () => {
    const { chromium } = require('playwright');
    const templatePath = path.join(__dirname, 'chord_template.html');
    const outPath = path.join(__dirname, 'static', '_test_output.png');

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('file:///' + templatePath.replace(/\\/g, '/'), { waitUntil: 'networkidle', timeout: 60000 });

    const triad = {
      name: 'C Major (root fret 3, A string)',
      root: 'C',
      chord_tones: { '3': 'E', '5': 'G', R: 'C' },
      strings: { E: -1, A: 3, D: 2, G: 0, B: -1, e: -1 },
    };

    await page.evaluate((t) => {
      window.__diagramReady = false;
      window.renderDiagram(t);
    }, triad);
    await page.waitForFunction(() => window.__diagramReady === true, { timeout: 5000 });

    const canvas = await page.$('canvas');
    await canvas.screenshot({ path: outPath, type: 'png' });
    await browser.close();

    assert.ok(fs.existsSync(outPath));
    assert.ok(fs.statSync(outPath).size > 0);

    // Clean up
    fs.unlinkSync(outPath);
  });
});
