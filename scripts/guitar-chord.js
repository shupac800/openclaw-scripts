#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const triadsPath = path.join(__dirname, '../sent_triads.json');
const data = JSON.parse(fs.readFileSync(triadsPath, 'utf8'));

const available = data.available_triads.filter(t => !data.sent_triads.includes(t.name));
if (available.length === 0) {
  console.log('All triads have been sent!');
  process.exit(0);
}

const triad = available[Math.floor(Math.random() * available.length)];

const stringToOrdinal = { e: '1st', B: '2nd', G: '3rd', D: '4th', A: '5th', E: '6th' };
function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function reformatParenthetical(name) {
  return name.replace(/\(root fret (\d+), (\w) string\)/, (_, fret, str) =>
    `(${stringToOrdinal[str]} string, ${ordinal(+fret)} fret)`
  );
}

const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const openSemitones = { E: 4, A: 9, D: 2, G: 7, B: 11, e: 4 };
const stringOrder = ['e', 'B', 'G', 'D', 'A', 'E'];

// Build reverse map: note name -> { interval, original }
const toneMap = {};
const flatMap = { 'Eb':'D#', 'Bb':'A#', 'Ab':'G#', 'Db':'C#', 'Gb':'F#', 'Fb':'E', 'Cb':'B' };
const intervalNameMap = { 'R':'R', '1':'R', 'b3':'m3', 'm3':'m3', '3':'3', 'b5':'dim5', '5-':'dim5', 'dim5':'dim5', '5':'5', '#5':'aug5', '5+':'aug5', 'aug5':'aug5' };
for (const [interval, note] of Object.entries(triad.chord_tones)) {
  const normalized = flatMap[note] || note;
  const displayInterval = intervalNameMap[interval] || interval;
  toneMap[normalized] = { interval: displayInterval, original: note };
}

let diagram = '';
const intervals = {};

for (const s of stringOrder) {
  const fret = triad.strings[s];
  let fretStr, intervalLabel = '';

  if (fret === -1) {
    fretStr = '-------';
  } else {
    const f = String(fret);
    // Pad fret to 7 chars centered
    const totalPad = 7 - f.length;
    const left = Math.floor(totalPad / 2);
    const right = totalPad - left;
    fretStr = '-'.repeat(left) + f + '-'.repeat(right);

    const semitone = (openSemitones[s] + fret) % 12;
    const noteName = noteNames[semitone];
    const entry = toneMap[noteName];
    intervalLabel = entry ? entry.interval : '?';
    if (entry && !intervals[intervalLabel]) intervals[intervalLabel] = entry.original;
  }

  diagram += `${s}|${fretStr}${intervalLabel ? '  ' + intervalLabel : ''}\n`;
}

// Build interval legend in musical order (root first)
const intervalOrder = ['R', 'm3', '3', 'dim5', '5', 'aug5'];
const legendParts = [];
for (const label of intervalOrder) {
  if (intervals[label]) legendParts.push(`${label}=${intervals[label]}`);
}
// Include any labels not in the predefined order
for (const [label, note] of Object.entries(intervals)) {
  if (!intervalOrder.includes(label)) legendParts.push(`${label}=${note}`);
}

let msg = `${reformatParenthetical(triad.name)}\n\n\`\`\`\n${diagram}\`\`\`\nIntervals: ${legendParts.join(', ')}`;

console.log(msg);

// Update sent_triads
data.sent_triads.push(triad.name);
fs.writeFileSync(triadsPath, JSON.stringify(data, null, 2) + '\n');
