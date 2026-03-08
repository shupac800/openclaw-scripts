#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const jobsPath = path.join(__dirname, '..', 'jobs.json');
const data = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));

const now = new Date();
const ct = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
const parts = ct.formatToParts(now);
const todayStr = `${parts.find(p=>p.type==='year').value}-${parts.find(p=>p.type==='month').value}-${parts.find(p=>p.type==='day').value}`;

const tomorrow = new Date(now.getTime() + 86400000);
const parts2 = ct.formatToParts(tomorrow);
const tomorrowStr = `${parts2.find(p=>p.type==='year').value}-${parts2.find(p=>p.type==='month').value}-${parts2.find(p=>p.type==='day').value}`;

const dateFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true });

const todayLabel = dateFmt.format(now);
const tomorrowLabel = dateFmt.format(tomorrow);

function getDateInCT(ms) {
  const d = new Date(ms);
  const p = ct.formatToParts(d);
  return `${p.find(x=>x.type==='year').value}-${p.find(x=>x.type==='month').value}-${p.find(x=>x.type==='day').value}`;
}

const todayEvents = [];
const tomorrowEvents = [];

for (const job of data.jobs) {
  if (!job.enabled) continue;
  const next = job.state && job.state.nextRunAtMs;
  if (!next) continue;

  const dateStr = getDateInCT(next);
  const timeStr = timeFmt.format(new Date(next));

  if (dateStr === todayStr) {
    todayEvents.push({ time: timeStr, name: job.name, ms: next });
  } else if (dateStr === tomorrowStr) {
    tomorrowEvents.push({ time: timeStr, name: job.name, ms: next });
  }
}

todayEvents.sort((a, b) => a.ms - b.ms);
tomorrowEvents.sort((a, b) => a.ms - b.ms);

let msg = `☀️ Good morning! Here's your briefing:\n\n📅 Today — ${todayLabel}\n`;
if (todayEvents.length === 0) {
  msg += '  Nothing scheduled.\n';
} else {
  for (const e of todayEvents) msg += `  • ${e.time} — ${e.name}\n`;
}

msg += `\n📅 Tomorrow — ${tomorrowLabel}\n`;
if (tomorrowEvents.length === 0) {
  msg += '  Nothing scheduled.\n';
} else {
  for (const e of tomorrowEvents) msg += `  • ${e.time} — ${e.name}\n`;
}

console.log(msg.trim());
