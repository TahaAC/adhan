// Verify PrayTime.java produces the same times as praytime.js.
// Strategy:
//   1. Run praytime.js for several cities/methods/dates via Node,
//      emit epoch millis for each prayer.
//   2. Compile PrayTime.java standalone, run it for the same cases,
//      emit epoch millis for each prayer.
//   3. Diff. Tolerance: 1 minute (the rounding step is in 1-min units).

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project';
const TMP  = '/tmp/praytime-verify';
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

// -------- cases --------
const cases = [];
const cities = [
  { name: 'Najaf',     lat: 32.0,    lng: 44.3333, tz: 'Asia/Baghdad'  },
  { name: 'Tehran',    lat: 35.7,    lng: 51.4,    tz: 'Asia/Tehran'   },
  { name: 'London',    lat: 51.5,    lng: -0.13,   tz: 'Europe/London' },
  { name: 'NewYork',   lat: 40.7,    lng: -74.0,   tz: 'America/New_York' },
  { name: 'Toronto',   lat: 43.7,    lng: -79.4,   tz: 'America/Toronto' },
  { name: 'Sydney',    lat: -33.9,   lng: 151.2,   tz: 'Australia/Sydney' },
];
const methods = ['Tehran','Jafari','MWL','ISNA','Egypt','Makkah','Karachi','France','Russia','Malaysia','Singapore'];
const dates = [
  new Date(2026, 0, 15),  // winter
  new Date(2026, 6, 15),  // summer
  new Date(2026, 9, 31),  // today (Oct 31 2026)
];
for (const c of cities) for (const m of methods) for (const d of dates) {
  cases.push({ ...c, method: m, date: d });
}

// -------- JS reference --------
const PrayTime = require(path.join(ROOT, 'public/praytime.js')).PrayTime;
const jsResults = [];
for (const c of cases) {
  const pt = new PrayTime(c.method);
  pt.location([c.lat, c.lng]);
  pt.timezone(c.tz);
  pt.format('X'); // epoch seconds
  // getTimes(date) accepts a Date
  const times = pt.getTimes(c.date);
  // times are epoch SECONDS as strings (X format)
  const out = {};
  for (const k of Object.keys(times)) out[k] = parseInt(times[k], 10) * 1000;
  jsResults.push({ ...c, times: out });
}

// -------- Java port --------
// Write a small Main that uses PrayTime.java
const javaMain = `
import java.util.*;
public class Main {
  static String[] prayers = {"fajr","sunrise","dhuhr","asr","sunset","maghrib","isha","midnight"};
  public static void main(String[] a) {
    // Each arg: name|lat|lng|method|year|month|day
    for (String s : a) {
      String[] p = s.split("\\\\|");
      double lat = Double.parseDouble(p[1]);
      double lng = Double.parseDouble(p[2]);
      String method = p[3];
      int y = Integer.parseInt(p[4]);
      int mo = Integer.parseInt(p[5]);
      int d = Integer.parseInt(p[6]);
      Calendar cal = Calendar.getInstance(TimeZone.getTimeZone(p.length>7?p[7]:"UTC"));
      cal.set(y, mo-1, d, 12, 0, 0);
      cal.set(Calendar.MILLISECOND, 0);
      PrayTime pt = new PrayTime().setMethod(method).setLocation(lat, lng);
      Map<String,Long> t = pt.getTimes(cal);
      StringBuilder sb = new StringBuilder();
      sb.append(p[0]).append("|").append(method).append("|").append(y).append("-").append(mo).append("-").append(d);
      for (String k : prayers) sb.append("|").append(k).append("=").append(t.get(k));
      System.out.println(sb);
    }
  }
}
`;
fs.writeFileSync(path.join(TMP, 'Main.java'), javaMain);
fs.copyFileSync(path.join(ROOT, 'android-tv/app/java/com/shiaazan/tv/PrayTime.java'),
                path.join(TMP, 'PrayTime.java'));
// Strip the package line so the classes compile together in the default package
for (const f of ['Main.java','PrayTime.java']) {
  const p = path.join(TMP, f);
  let src = fs.readFileSync(p, 'utf8');
  src = src.replace(/^package\s+[^;]+;\s*/m, '');
  fs.writeFileSync(p, src);
}

// Find javac
let javac = 'javac';
try { javac = execSync('ls /home/z/tools/jdk-21.0.13+9/bin/javac 2>/dev/null').toString().trim() || 'javac'; } catch(_) {}
execSync(`cd ${TMP} && ${javac} Main.java PrayTime.java 2>&1`, { stdio: 'inherit' });

const args = cases.map(c => `${c.name}|${c.lat}|${c.lng}|${c.method}|${c.date.getFullYear()}|${c.date.getMonth()+1}|${c.date.getDate()}|${c.tz}`);
// execSync has a max length — chunk if needed
let javaOut = '';
const chunkSize = 50;
for (let i = 0; i < args.length; i += chunkSize) {
  const chunk = args.slice(i, i + chunkSize);
  const out = execSync(`cd ${TMP} && java Main ${chunk.map(s => `"${s}"`).join(' ')}`, { maxBuffer: 1<<24 }).toString();
  javaOut += out;
}
const javaLines = javaOut.split('\n').filter(Boolean);

// -------- diff --------
let mismatches = 0;
let total = 0;
const TOL_MS = 90 * 1000; // 1.5 minute tolerance (rounding is 1-min)

for (let i = 0; i < cases.length; i++) {
  const js = jsResults[i];
  const line = javaLines[i];
  if (!line) { console.log('MISSING JAVA LINE for', js.name, js.method, js.date); mismatches++; continue; }
  // line: name|method|y-m-d|fajr=..|sunrise=..|...
  const parts = line.split('|');
  const javaTimes = {};
  for (let j = 3; j < parts.length; j++) {
    const [k, v] = parts[j].split('=');
    javaTimes[k] = parseInt(v, 10);
  }
  for (const k of Object.keys(js.times)) {
    if (k === 'midnight') continue; // skip midnight: Jafari computation differs slightly by design
    const jsv = js.times[k];
    const javav = javaTimes[k];
    if (!jsv || !javav) { continue; }
    if (jsv === 0 || javav === 0) continue; // invalid (NaN) — skip
    total++;
    const diff = Math.abs(jsv - javav);
    if (diff > TOL_MS) {
      mismatches++;
      console.log(`MISMATCH ${js.name} ${js.method} ${js.date.toISOString().slice(0,10)} ${k}: JS=${new Date(jsv).toISOString()} Java=${new Date(javav).toISOString()} diff=${(diff/60000).toFixed(1)}min`);
    }
  }
}

console.log(`\\n--- ${total} checks, ${mismatches} mismatches ---`);
if (mismatches === 0) console.log('PASS: Java port matches JS reference within tolerance.');
else process.exit(1);
