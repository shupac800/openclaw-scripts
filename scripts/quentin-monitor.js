#!/usr/bin/env node
const https = require('https');

https.get('https://quentin.shupac.com', { timeout: 10000 }, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    if (data.length > 0) {
      console.log('✅ quentin.shupac.com is UP');
    } else {
      console.log('❌ quentin.shupac.com is DOWN — empty response');
    }
  });
}).on('error', (err) => {
  console.log('❌ quentin.shupac.com is DOWN — ' + err.message);
}).on('timeout', function () {
  this.destroy();
  console.log('❌ quentin.shupac.com is DOWN — timeout');
});
