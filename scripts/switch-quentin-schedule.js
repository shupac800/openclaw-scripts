#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const jobsPath = '/home/ubuntu/.openclaw/cron/jobs.json';
const data = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
const job = data.jobs.find(j => j.id === 'a32c1e4e-2a74-444a-9736-cf795b052597');

if (!job) {
  console.log('quentin monitor job not found');
  process.exit(1);
}

if (job.schedule.expr === '0 */4 * * *') {
  console.log('quentin monitor already set to every 4 hours — no change needed');
} else {
  job.schedule.expr = '0 */4 * * *';
  job.updatedAtMs = Date.now();
  fs.writeFileSync(jobsPath, JSON.stringify(data, null, 2) + '\n');
  console.log('quentin monitor updated to every 4 hours');
}
