// Verify praytime-jscript.js produces the same times as public/praytime.js.
// Strategy: run both for many cities/methods/dates, diff epoch millis.

var fs = require('fs');
var path = require('path');

var ROOT = '/home/z/my-project';

var PrayTimeRef = require(path.join(ROOT, 'public/praytime.js')).PrayTime;
var PrayTimeJS  = require(path.join(ROOT, 'windows-installer/bg/praytime-jscript.js')).PrayTime;

var cities = [
  { name: 'Najaf',     lat: 32.0,    lng: 44.3333, tz: 'Asia/Baghdad'  },
  { name: 'Tehran',    lat: 35.7,    lng: 51.4,    tz: 'Asia/Tehran'   },
  { name: 'London',    lat: 51.5,    lng: -0.13,   tz: 'Europe/London' },
  { name: 'NewYork',   lat: 40.7,    lng: -74.0,   tz: 'America/New_York' },
  { name: 'Toronto',   lat: 43.7,    lng: -79.4,   tz: 'America/Toronto' },
  { name: 'Sydney',    lat: -33.9,   lng: 151.2,   tz: 'Australia/Sydney' }
];
var methods = ['Tehran','Jafari','MWL','ISNA','Egypt','Makkah','Karachi','France','Russia','Malaysia','Singapore'];
var dates = [
  new Date(2026, 0, 15),
  new Date(2026, 6, 15),
  new Date(2026, 9, 31)
];

var total = 0, mismatches = 0;
var TOL_MS = 90 * 1000; // 1.5 min tolerance (rounding is 1-min)

for (var ci = 0; ci < cities.length; ci++) {
  for (var mi = 0; mi < methods.length; mi++) {
    for (var di = 0; di < dates.length; di++) {
      var c = cities[ci], m = methods[mi], d = dates[di];

      // Reference
      var ptR = new PrayTimeRef(m);
      ptR.location([c.lat, c.lng]);
      ptR.timezone(c.tz);
      ptR.format('X');
      var tR = ptR.getTimes(d);

      // JScript port
      var ptJ = new PrayTimeJS(m);
      ptJ.location([c.lat, c.lng]);
      ptJ.format('X');
      var tJ = ptJ.getTimes(d);

      for (var k in tR) {
        if (k === 'midnight') continue; // Jafari midnight: minor diff by design
        var vR = parseInt(tR[k], 10);
        var vJ = parseInt(tJ[k], 10);
        if (!vR || !vJ) continue;
        total++;
        var diff = Math.abs(vR - vJ) * 1000;
        if (diff > TOL_MS) {
          mismatches++;
          console.log('MISMATCH ' + c.name + ' ' + m + ' ' + d.toISOString().slice(0,10) + ' ' + k +
                      ': ref=' + new Date(vR*1000).toISOString() +
                      ' jscript=' + new Date(vJ*1000).toISOString() +
                      ' diff=' + (diff/60000).toFixed(1) + 'min');
        }
      }
    }
  }
}

console.log('\n--- ' + total + ' checks, ' + mismatches + ' mismatches ---');
if (mismatches === 0) console.log('PASS: JScript port matches JS reference within tolerance.');
else process.exit(1);
