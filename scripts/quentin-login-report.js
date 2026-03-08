#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load SSH config from TOOLS.md
const toolsMd = fs.readFileSync(path.resolve(__dirname, '../../workspace/TOOLS.md'), 'utf8');
const host = toolsMd.match(/Host:\s*`([^`]+)`/)?.[1];
const user = toolsMd.match(/User:\s*`([^`]+)`/)?.[1];
const key = toolsMd.match(/Key:\s*`([^`]+)`/)?.[1];

if (!host || !user || !key) {
  console.log('⚠️ Missing SSH config in TOOLS.md (quentin section)');
  process.exit(1);
}

const sshCmd = `ssh -i ${key} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${user}@${host} "cat /home/bitnami/apps/quentin/logs/usage-diff.txt"`;

try {
  const output = execSync(sshCmd, { encoding: 'utf8', timeout: 30000 }).trim();

  if (!output) {
    console.log('✅ No new Quentin logins');
    process.exit(0);
  }

  const lines = output.split('\n').filter(l => l.trim());
  const logins = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.event === 'login') {
        const t = new Date(entry.time);
        const timeStr = t.toLocaleString('en-US', {
          timeZone: 'America/Chicago',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }).toLowerCase();
        logins.push(`- ${entry.user} - ${timeStr}`);
      }
    } catch (e) {
      // skip non-JSON lines
    }
  }

  if (logins.length === 0) {
    console.log('✅ No new Quentin logins');
  } else {
    console.log('new Quentin logins\n' + logins.join('\n'));
  }
} catch (err) {
  console.log('⚠️ SSH failed: ' + err.message);
}
