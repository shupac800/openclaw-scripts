#!/usr/bin/env node
const https = require('https');

const url = 'https://api.open-meteo.com/v1/forecast?latitude=36.2081&longitude=-86.7816&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&timezone=America/Chicago';

const weatherCodes = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  56: 'Freezing drizzle (light)', 57: 'Freezing drizzle (dense)',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Freezing rain (light)', 67: 'Freezing rain (heavy)',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ slight hail', 99: 'Thunderstorm w/ heavy hail'
};

const windDirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const j = JSON.parse(data);
      const c = j.current;
      const temp = Math.round(c.temperature_2m);
      const humidity = c.relative_humidity_2m;
      const wind = Math.round(c.wind_speed_10m);
      const windDir = windDirs[Math.round(c.wind_direction_10m / 22.5) % 16];
      const conditions = weatherCodes[c.weather_code] || `Code ${c.weather_code}`;
      const now = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', hour12: true });

      console.log(`🌤 Fairview, TN — ${now}\n${conditions}, ${temp}°F\nHumidity: ${humidity}% | Wind: ${wind} mph ${windDir}`);
    } catch (e) {
      console.log('⚠️ Weather fetch failed: ' + e.message);
    }
  });
}).on('error', (err) => {
  console.log('⚠️ Weather fetch failed: ' + err.message);
});
