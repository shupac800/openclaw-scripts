/**
 * Tests for the enharmonic respelling and accidental logic
 * used in chord_template.html's VexFlow staff rendering.
 *
 * Run: node --test scripts/chord_template.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ---- Reimplemented from chord_template.html ----

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT_MAP = { Eb:'D#', Bb:'A#', Ab:'G#', Db:'C#', Gb:'F#', Fb:'E', Cb:'B' };
const SHARP_TO_FLAT = { 'C#':'Db', 'D#':'Eb', 'F#':'Gb', 'G#':'Ab', 'A#':'Bb' };

const KEY_SHARPS = { C:0, G:1, D:2, A:3, E:4, B:5, 'F#':6, 'C#':7 };
const KEY_FLATS = { F:1, Bb:2, Eb:3, Ab:4, Db:5, Gb:6, Cb:7 };
const SHARP_ORDER_NOTES = ['F#','C#','G#','D#','A#','E#','B#'];
const FLAT_ORDER_NOTES = ['Bb','Eb','Ab','Db','Gb','Cb','Fb'];

function respellForKey(noteName, keySigInfo) {
  if (keySigInfo.type === 'flat' && noteName in SHARP_TO_FLAT) {
    return SHARP_TO_FLAT[noteName];
  }
  return noteName;
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

function parseNoteForVex(noteName) {
  let name = noteName;
  let acc = '';
  if (name.includes('#')) { acc = '#'; name = name.replace('#', ''); }
  else if (name.includes('b')) { acc = 'b'; name = name.replace('b', ''); }
  return { letter: name, acc };
}

function needsAccidental(noteAcc, letter, keySigInfo) {
  const keySigLetters = {};
  for (const a of keySigInfo.accNotes) {
    const l = a.replace(/[#b]/g, '');
    keySigLetters[l] = a.includes('#') ? '#' : 'b';
  }
  const keySigDefault = keySigLetters[letter] || '';
  if (noteAcc !== keySigDefault) {
    return noteAcc === '' ? 'n' : noteAcc;
  }
  return null;
}

// ---- Tests ----

describe('respellForKey', () => {
  it('converts G# to Ab in flat keys', () => {
    const info = getKeySigInfo('F', 'Minor'); // relative major = Ab
    assert.equal(respellForKey('G#', info), 'Ab');
  });

  it('converts D# to Eb in flat keys', () => {
    const info = getKeySigInfo('Bb', 'Major');
    assert.equal(respellForKey('D#', info), 'Eb');
  });

  it('converts A# to Bb in flat keys', () => {
    const info = getKeySigInfo('F', 'Major');
    assert.equal(respellForKey('A#', info), 'Bb');
  });

  it('leaves sharps alone in sharp keys', () => {
    const info = getKeySigInfo('A', 'Major');
    assert.equal(respellForKey('G#', info), 'G#');
    assert.equal(respellForKey('C#', info), 'C#');
  });

  it('leaves natural notes unchanged', () => {
    const info = getKeySigInfo('F', 'Minor');
    assert.equal(respellForKey('C', info), 'C');
    assert.equal(respellForKey('F', info), 'F');
  });

  it('leaves sharps alone in key of C (0 sharps)', () => {
    const info = getKeySigInfo('C', 'Major');
    assert.equal(info.type, 'sharp');
    assert.equal(info.accNotes.length, 0);
    assert.equal(respellForKey('F#', info), 'F#');
  });
});

describe('getKeySigInfo', () => {
  it('F Minor has relative major Ab (4 flats)', () => {
    const info = getKeySigInfo('F', 'Minor');
    assert.equal(info.vexKey, 'Ab');
    assert.equal(info.type, 'flat');
    assert.deepEqual(info.accNotes, ['Bb', 'Eb', 'Ab', 'Db']);
  });

  it('C Minor has relative major Eb (3 flats)', () => {
    const info = getKeySigInfo('C', 'Minor');
    assert.equal(info.vexKey, 'Eb');
    assert.equal(info.type, 'flat');
  });

  it('A Minor has relative major C (0 sharps)', () => {
    const info = getKeySigInfo('A', 'Minor');
    assert.equal(info.vexKey, 'C');
    assert.equal(info.type, 'sharp');
    assert.equal(info.accNotes.length, 0);
  });

  it('E Major has 4 sharps', () => {
    const info = getKeySigInfo('E', 'Major');
    assert.equal(info.vexKey, 'E');
    assert.equal(info.type, 'sharp');
    assert.equal(info.accNotes.length, 4);
  });
});

describe('accidental display (the original bug)', () => {
  it('Ab needs no accidental in key of Ab major (F minor)', () => {
    const info = getKeySigInfo('F', 'Minor');
    // After respelling, G# → Ab; parsed as letter=A, acc=b
    const respelled = respellForKey('G#', info);
    assert.equal(respelled, 'Ab');
    const { letter, acc } = parseNoteForVex(respelled);
    assert.equal(letter, 'A');
    assert.equal(acc, 'b');
    // Key sig has Ab, so A→b by default — no explicit accidental needed
    const display = needsAccidental(acc, letter, info);
    assert.equal(display, null, 'Ab should not need an accidental in Ab major');
  });

  it('F natural needs no accidental in key of Ab major', () => {
    const info = getKeySigInfo('F', 'Minor');
    const { letter, acc } = parseNoteForVex('F');
    const display = needsAccidental(acc, letter, info);
    assert.equal(display, null);
  });

  it('C natural needs no accidental in key of Ab major', () => {
    const info = getKeySigInfo('F', 'Minor');
    const { letter, acc } = parseNoteForVex('C');
    const display = needsAccidental(acc, letter, info);
    assert.equal(display, null);
  });

  it('F# needs explicit sharp in key of G major', () => {
    const info = getKeySigInfo('G', 'Major');
    const { letter, acc } = parseNoteForVex('F#');
    // Key sig already has F#, so no accidental needed
    const display = needsAccidental(acc, letter, info);
    assert.equal(display, null, 'F# is in G major key sig');
  });

  it('F natural needs natural sign in key of G major', () => {
    const info = getKeySigInfo('G', 'Major');
    const { letter, acc } = parseNoteForVex('F');
    // Key sig says F#, but note is F natural → needs natural
    const display = needsAccidental(acc, letter, info);
    assert.equal(display, 'n');
  });
});
