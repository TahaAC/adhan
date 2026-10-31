// praytime.ts - Prayer Times Calculator (v3.2)
// Copyright (c) 2007-2025 Hamid Zarrabi-Zadeh
// Source: https://praytimes.org
// License: MIT
//
// TypeScript port of the provided PrayTime class. The API is identical to
// the original JavaScript version: instantiate with a method name, then
// chain setters and call .times() (or .getTimes()) to receive the prayer
// schedule for the configured location and date.

export type PrayerMethod =
  | 'MWL'
  | 'ISNA'
  | 'Egypt'
  | 'Makkah'
  | 'Karachi'
  | 'Tehran'
  | 'Jafari'
  | 'France'
  | 'Russia'
  | 'Malaysia'
  | 'Singapore';

export type TimeFormat = '24h' | '12h' | '12H' | 'x' | 'X';
export type RoundingMethod = 'nearest' | 'up' | 'down' | 'none';
export type AsrMethod = 'Standard' | 'Hanafi';
export type HighLatsMethod = 'None' | 'NightMiddle' | 'OneSeventh' | 'AngleBased';
export type MidnightMethod = 'Standard' | 'Jafari';

export interface PrayerTimes {
  fajr: string | number;
  sunrise: string | number;
  dhuhr: string | number;
  asr: string | number;
  sunset: string | number;
  maghrib: string | number;
  isha: string | number;
  midnight: string | number;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

type NumStr = number | string;

interface MethodParams {
  fajr?: NumStr;
  isha?: NumStr;
  maghrib?: NumStr;
  midnight?: MidnightMethod;
}

interface Settings {
  dhuhr: NumStr;
  asr: AsrMethod | NumStr;
  highLats: HighLatsMethod;
  tune: Partial<Record<keyof PrayerTimes, number>>;
  format: TimeFormat;
  rounding: RoundingMethod;
  utcOffset: NumStr | number;
  timezone: string;
  location: [number, number];
  iterations: number;
  fajr?: NumStr;
  isha?: NumStr;
  maghrib?: NumStr;
  midnight?: MidnightMethod;
}

export class PrayTime {
  methods: Record<PrayerMethod | 'defaults', MethodParams>;

  settings: Settings;

  labels: string[];

  utcTime: number = 0;

  adjusted: boolean = false;

  constructor(method?: PrayerMethod) {
    this.methods = {
      MWL: { fajr: 18, isha: 17 },
      ISNA: { fajr: 15, isha: 15 },
      Egypt: { fajr: 19.5, isha: 17.5 },
      Makkah: { fajr: 18.5, isha: '90 min' },
      Karachi: { fajr: 18, isha: 18 },
      Tehran: { fajr: 17.7, maghrib: 4.5, midnight: 'Jafari' },
      Jafari: { fajr: 16, maghrib: 4, midnight: 'Jafari' },
      France: { fajr: 12, isha: 12 },
      Russia: { fajr: 16, isha: 15 },
      Malaysia: { fajr: 20, isha: 18 }, // JAKIM
      Singapore: { fajr: 20, isha: 18 },
      defaults: { isha: 14, maghrib: '1 min', midnight: 'Standard' },
    };

    this.settings = {
      dhuhr: '0 min',
      asr: 'Standard',
      highLats: 'NightMiddle',
      tune: {},
      format: '24h',
      rounding: 'nearest',
      utcOffset: 'auto',
      timezone:
        typeof Intl !== 'undefined'
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : 'UTC',
      location: [0, -(new Date().getTimezoneOffset()) / 4],
      iterations: 1,
    };

    this.labels = [
      'Fajr',
      'Sunrise',
      'Dhuhr',
      'Asr',
      'Sunset',
      'Maghrib',
      'Isha',
      'Midnight',
    ];

    this.method(method || 'MWL');
  }

  //---------------------- Setters ------------------------

  method(method?: PrayerMethod): this {
    return this.set(this.methods.defaults).set(
      method ? this.methods[method] : {},
    );
  }

  adjust(params: Partial<Settings>): this {
    return this.set(params);
  }

  location(location: [number, number]): this {
    return this.set({ location });
  }

  timezone(timezone: string): this {
    return this.set({ timezone });
  }

  tune(tune: Partial<Record<keyof PrayerTimes, number>>): this {
    return this.set({ tune });
  }

  round(rounding: RoundingMethod = 'nearest'): this {
    return this.set({ rounding });
  }

  format(format: TimeFormat): this {
    return this.set({ format });
  }

  set(settings: Partial<Settings>): this {
    Object.assign(this.settings, settings);
    return this;
  }

  utcOffset(utcOffset: NumStr | number = 'auto'): this {
    if (typeof utcOffset === 'number' && Math.abs(utcOffset) < 16)
      (utcOffset as number) *= 60;
    this.set({ timezone: 'UTC' });
    return this.set({ utcOffset });
  }

  //---------------------- Getters ------------------------

  times(date: Date | number | [number, number, number] = 0): PrayerTimes {
    let d = date as
      | number
      | Date
      | [number, number, number];
    if (typeof d === 'number')
      d = new Date(
        d < 1000 ? Date.now() + d * 86400000 : d,
      );
    if (d instanceof Date)
      d = [d.getFullYear(), d.getMonth() + 1, d.getDate()];
    this.utcTime = Date.UTC(d[0], d[1] - 1, d[2]);

    const times = this.computeTimes();
    this.formatTimes(times);
    return times;
  }

  getTimes(
    date?: Date | number,
    location?: [number, number],
    timezone: NumStr = 'auto',
    dst: number = 0,
    format: TimeFormat = '24h',
  ): PrayerTimes {
    if (!location) return this.times(date || 0);
    const utcOffset = timezone == 'auto' ? timezone : (timezone as number) + dst;
    this.location(location).utcOffset(utcOffset).format(format);
    return this.times(date || 0);
  }

  //---------------------- Compute Times -----------------------

  computeTimes(): PrayerTimes {
    let times: PrayerTimes = {
      fajr: 5,
      sunrise: 6,
      dhuhr: 12,
      asr: 13,
      sunset: 18,
      maghrib: 18,
      isha: 18,
      midnight: 24,
    };

    for (let i = 0; i < this.settings.iterations; i++)
      times = this.processTimes(times);

    this.adjustHighLats(times);
    this.updateTimes(times);
    this.tuneTimes(times);
    this.convertTimes(times);
    return times;
  }

  processTimes(times: PrayerTimes): PrayerTimes {
    const params = this.settings;
    const horizon = 0.833;

    return {
      fajr: this.angleTime(params.fajr as NumStr, times.fajr as number, -1),
      sunrise: this.angleTime(horizon, times.sunrise as number, -1),
      dhuhr: this.midDay(times.dhuhr as number),
      asr: this.angleTime(
        this.asrAngle(params.asr, times.asr as number),
        times.asr as number,
      ),
      sunset: this.angleTime(horizon, times.sunset as number),
      maghrib: this.angleTime(
        params.maghrib as NumStr,
        times.maghrib as number,
      ),
      isha: this.angleTime(params.isha as NumStr, times.isha as number),
      midnight: this.midDay(times.midnight as number) + 12,
    };
  }

  updateTimes(times: PrayerTimes): void {
    const params = this.settings;

    if (this.isMin(params.maghrib))
      times.maghrib =
        (times.sunset as number) + this.value(params.maghrib as NumStr) / 60;
    if (this.isMin(params.isha))
      times.isha =
        (times.maghrib as number) + this.value(params.isha as NumStr) / 60;
    if (params.midnight == 'Jafari') {
      const nextFajr = this.angleTime(
        params.fajr as NumStr,
        29,
        -1,
      ) + 24;
      times.midnight =
        ((times.sunset as number) +
          (this.adjusted ? (times.fajr as number) + 24 : nextFajr)) /
        2;
    }
    times.dhuhr = (times.dhuhr as number) + this.value(params.dhuhr) / 60;
  }

  tuneTimes(times: PrayerTimes): void {
    const mins = this.settings.tune;
    for (const i in times)
      if (i in mins)
        times[i as keyof PrayerTimes] =
          (times[i as keyof PrayerTimes] as number) +
          (mins[i as keyof PrayerTimes] as number) / 60;
  }

  convertTimes(times: PrayerTimes): void {
    const lng = this.settings.location[1];
    for (const i in times) {
      const time = (times[i as keyof PrayerTimes] as number) - lng / 15;
      // 36e5 = 3,600,000 ms = 1 hour. Convert decimal hours to ms.
      const timestamp = this.utcTime + Math.floor(time * 3.6e6);
      times[i as keyof PrayerTimes] = this.roundTime(timestamp);
    }
  }

  roundTime(timestamp: number): number {
    const rounding = (
      {
        up: 'ceil',
        down: 'floor',
        nearest: 'round',
      } as const
    )[this.settings.rounding];
    if (!rounding) return timestamp;
    const OneMinute = 60000;
    return Math[rounding](timestamp / OneMinute) * OneMinute;
  }

  //---------------------- Calculation Functions -----------------------

  sunPosition(time: NumStr): { declination: number; equation: number } {
    const lng = this.settings.location[1];
    const D =
      this.utcTime / 86400000 - 10957.5 + this.value(time) / 24 - lng / 360;

    const g = this.mod(357.529 + 0.98560028 * D, 360);
    const q = this.mod(280.459 + 0.98564736 * D, 360);
    const L = this.mod(
      q + 1.915 * this.sin(g) + 0.02 * this.sin(2 * g),
      360,
    );
    const e = 23.439 - 0.00000036 * D;
    const RA = this.mod(
      this.arctan2(this.cos(e) * this.sin(L), this.cos(L)) / 15,
      24,
    );

    return {
      declination: this.arcsin(this.sin(e) * this.sin(L)),
      equation: q / 15 - RA,
    };
  }

  midDay(time: number): number {
    const eqt = this.sunPosition(time).equation;
    const noon = this.mod(12 - eqt, 24);
    return noon;
  }

  angleTime(angle: NumStr, time: number, direction: number = 1): number {
    const lat = this.settings.location[0];
    const decl = this.sunPosition(time).declination;
    const numerator =
      -this.sin(angle as number) - this.sin(lat) * this.sin(decl);
    const diff =
      this.arccos(numerator / (this.cos(lat) * this.cos(decl))) / 15;
    return this.midDay(time) + diff * direction;
  }

  asrAngle(asrParam: AsrMethod | NumStr, time: number): number {
    const shadowFactor =
      ({ Standard: 1, Hanafi: 2 } as const)[asrParam as AsrMethod] ||
      this.value(asrParam as NumStr);
    const lat = this.settings.location[0];
    const decl = this.sunPosition(time).declination;
    return -this.arccot(shadowFactor + this.tan(Math.abs(lat - decl)));
  }

  //---------------------- Higher Latitudes -----------------------

  adjustHighLats(times: PrayerTimes): void {
    const params = this.settings;
    if (params.highLats == 'None') return;

    this.adjusted = false;
    const night = 24 + (times.sunrise as number) - (times.sunset as number);

    Object.assign(times, {
      fajr: this.adjustTime(
        times.fajr as number,
        times.sunrise as number,
        params.fajr as NumStr,
        night,
        -1,
      ),
      isha: this.adjustTime(
        times.isha as number,
        times.sunset as number,
        params.isha as NumStr,
        night,
      ),
      maghrib: this.adjustTime(
        times.maghrib as number,
        times.sunset as number,
        params.maghrib as NumStr,
        night,
      ),
    });
  }

  adjustTime(
    time: number,
    base: number,
    angle: NumStr,
    night: number,
    direction: number = 1,
  ): number {
    const factors = {
      NightMiddle: 1 / 2,
      OneSeventh: 1 / 7,
      AngleBased: (1 / 60) * this.value(angle),
    } as const;
    const portion = factors[this.settings.highLats] * night;
    const timeDiff = (time - base) * direction;
    if (isNaN(time) || timeDiff > portion) {
      time = base + portion * direction;
      this.adjusted = true;
    }
    return time;
  }

  //---------------------- Formatting Functions ---------------------

  formatTimes(times: PrayerTimes): void {
    for (const i in times)
      times[i as keyof PrayerTimes] = this.formatTime(
        times[i as keyof PrayerTimes] as number,
      );
  }

  formatTime(timestamp: number): string | number {
    const format = this.settings.format;
    const InvalidTime = '-----';
    if (isNaN(timestamp)) return InvalidTime;
    if (typeof format === 'function') return format(timestamp);
    if (format.toLowerCase() == 'x')
      return Math.floor(timestamp / (format == 'X' ? 1000 : 1));
    return this.timeToString(timestamp, format);
  }

  timeToString(timestamp: number, format: TimeFormat): string {
    const utcOffset = this.settings.utcOffset;
    const date = new Date(
      timestamp +
        (utcOffset == 'auto' ? 0 : (utcOffset as number)) * 60000,
    );
    const str = date.toLocaleTimeString('en-US', {
      timeZone: this.settings.timezone,
      hour12: format == '24h' ? false : true,
      hour: format == '24h' ? '2-digit' : 'numeric',
      minute: '2-digit',
    });
    return format == '12H' ? str.replace(/ ?[AP]M/, '') : str;
  }

  //---------------------- Misc Functions -----------------------

  value(str: NumStr): number {
    return +String(str).split(/[^0-9.+-]/)[0];
  }

  isMin(str?: NumStr): boolean {
    return String(str).indexOf('min') != -1;
  }

  mod(a: number, b: number): number {
    return ((a % b) + b) % b;
  }

  //--------------------- Degree-Based Trigonometry -----------------

  dtr = (d: number): number => (d * Math.PI) / 180;
  rtd = (r: number): number => (r * 180) / Math.PI;

  sin = (d: number): number => Math.sin(this.dtr(d));
  cos = (d: number): number => Math.cos(this.dtr(d));
  tan = (d: number): number => Math.tan(this.dtr(d));

  arcsin = (d: number): number => this.rtd(Math.asin(d));
  arccos = (d: number): number => this.rtd(Math.acos(d));
  arctan = (d: number): number => this.rtd(Math.atan(d));

  arccot = (x: number): number => this.rtd(Math.atan(1 / x));
  arctan2 = (y: number, x: number): number => this.rtd(Math.atan2(y, x));
}

export default PrayTime;
