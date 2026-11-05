// test-tv-times.js — verify tv.html's computation pipeline matches the
// main app's TypeScript PrayTime port, and sanity-check the schedule.
const { execSync } = require('child_process');
const fs = require('fs');

// 1. Compile the TS port (source of truth) to JS.
//    (Temp copy: drop the `typeof format === 'function'` branch — a known
//    type-narrowing quirk that tsc rejects; behaviour is irrelevant here
//    since we only ever pass string formats.)
fs.mkdirSync('/tmp/ptsrc', { recursive: true });
fs.copyFileSync('src/lib/praytime.ts', '/tmp/ptsrc/praytime.ts');
fs.writeFileSync('/tmp/ptsrc/praytime.ts',
  fs.readFileSync('/tmp/ptsrc/praytime.ts', 'utf8')
    .replace("if (typeof format === 'function') return format(timestamp);", ''));
execSync('node_modules/.bin/tsc /tmp/ptsrc/praytime.ts --outDir /tmp/ptjs --module commonjs --target es2020 --skipLibCheck', { stdio: 'inherit' });
const { PrayTime: TS } = require('/tmp/ptjs/praytime.js');

// 2. Load the plain-JS library used inside tv.html
const { PrayTime: JS } = require('/home/z/my-project/public/praytime.js');

const cities = [
  { name: 'Najaf', lat: 32.0, lng: 44.3333, tz: 'Asia/Baghdad' },
  { name: 'Tehran', lat: 35.6892, lng: 51.389, tz: 'Asia/Tehran' },
  { name: 'Karachi', lat: 24.8607, lng: 67.0011, tz: 'Asia/Karachi' },
  { name: 'London', lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093, tz: 'Australia/Sydney' },
  { name: 'New York', lat: 40.7128, lng: -74.006, tz: 'America/New_York' },
];
const methods = ['Tehran', 'Jafari', 'Karachi', 'MWL', 'ISNA'];
const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'midnight'];

function computeJS(city, method, ymd) {
  const pt = new JS(method);
  pt.location([city.lat, city.lng]);
  pt.timezone(city.tz);
  pt.adjust({ asr: 'Standard' });
  pt.format('X');
  return pt.times(ymd);
}
function computeTS(city, method, ymd) {
  const pt = new TS(method);
  pt.location([city.lat, city.lng]);
  pt.timezone(city.tz);
  pt.adjust({ asr: 'Standard' });
  pt.format('X');
  return pt.times(ymd);
}

let failures = 0;
const today = new Date();
const ymd = [today.getFullYear(), today.getMonth() + 1, today.getDate()];

for (const city of cities) {
  for (const method of methods) {
    const a = computeJS(city, method, ymd);
    const b = computeTS(city, method, ymd);
    for (const p of PRAYERS) {
      const va = a[p], vb = b[p];
      if (typeof va !== 'number' || typeof vb !== 'number') {
        console.log(`FAIL ${city.name}/${method}/${p}: non-numeric ${va} vs ${vb}`); failures++; continue;
      }
      if (Math.abs(va - vb) > 1) { console.log(`FAIL ${city.name}/${method}/${p}: ${va} vs ${vb} (diff ${va - vb}s)`); failures++; }
    }
    // sanity: ordering within the day (in city tz)
    const fmtT = (s) => new Date(s * 1000).toLocaleTimeString('en-GB', { timeZone: city.tz, hour12: false });
    const seq = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
    for (let i = 1; i < seq.length; i++) {
      if (a[seq[i]] <= a[seq[i - 1]]) {
        console.log(`FAIL order ${city.name}/${method}: ${seq[i - 1]}=${fmtT(a[seq[i - 1]])} >= ${seq[i]}=${fmtT(a[seq[i]])}`); failures++;
      }
    }
    // dhuhr should be between 11:00 and 14:30 local
    const dh = new Date(a.dhuhr * 1000).toLocaleString('en-GB', { timeZone: city.tz, hour12: false });
    const hour = parseInt(new Date(a.dhuhr * 1000).toLocaleString('en-GB', { timeZone: city.tz, hour: '2-digit', hour12: false }), 10);
    if (hour < 11 || hour > 14) { console.log(`FAIL dhuhr range ${city.name}/${method}: ${dh}`); failures++; }
    // midnight must be between maghrib and tomorrow fajr
    const npt = new JS(method); npt.location([city.lat, city.lng]); npt.timezone(city.tz); npt.adjust({ asr: 'Standard' }); npt.format('X');
    const tmr = new Date(today.getTime() + 86400000);
    const t = npt.times([tmr.getFullYear(), tmr.getMonth() + 1, tmr.getDate()]);
    if (!(a.maghrib < a.midnight && a.midnight < t.fajr)) {
      console.log(`FAIL midnight ${city.name}/${method}: maghrib=${fmtT(a.maghrib)} mid=${fmtT(a.midnight)} nextFajr=${fmtT(t.fajr)}`); failures++;
    }
  }
}

// Show a sample schedule for human verification (Najaf, Tehran method)
const s = computeJS(cities[0], 'Tehran', ymd);
console.log('\nSample — Najaf, Tehran method, ' + ymd.join('-'));
for (const p of PRAYERS) console.log(' ', p.padEnd(8), new Date(s[p] * 1000).toLocaleString('en-GB', { timeZone: 'Asia/Baghdad', hour12: false, hour: '2-digit', minute: '2-digit' }));

console.log(failures === 0 ? '\nALL CHECKS PASSED (JS lib == TS port, ordering, ranges)' : `\n${failures} FAILURES`);
process.exit(failures ? 1 : 0);
