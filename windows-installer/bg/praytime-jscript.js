// praytime-jscript.js - Prayer Times Calculator (v3.2)
// JScript port of public/praytime.js for Windows Script Host.
//
// Compatible with JScript 5.x (no class syntax, no arrow functions,
// no let/const, no Intl, no Object.assign, no template literals).
// Also runs under Node.js for testing.
//
// Copyright (c) 2007-2025 Hamid Zarrabi-Zadeh
// Source: https://praytimes.org
// License: MIT

function PrayTime(method) {
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
        Malaysia: { fajr: 20, isha: 18 },
        Singapore: { fajr: 20, isha: 18 },
        defaults: { isha: 14, maghrib: '1 min', midnight: 'Standard' }
    };

    this.settings = {
        dhuhr: '0 min',
        asr: 'Standard',
        highLats: 'NightMiddle',
        tune: {},
        format: '24h',
        rounding: 'nearest',
        utcOffset: 'auto',
        // JScript has no Intl; this placeholder is unused when format='X'.
        timezone: 'UTC',
        location: [0, -(new Date()).getTimezoneOffset() / 4],
        iterations: 1
    };

    this.labels = [
        'Fajr', 'Sunrise', 'Dhuhr', 'Asr',
        'Sunset', 'Maghrib', 'Isha', 'Midnight'
    ];

    this.method(method || 'MWL');
}

//---------------------- Setters ------------------------

PrayTime.prototype.method = function(method) {
    return this.set(this.methods.defaults).set(this.methods[method]);
};

PrayTime.prototype.adjust = function(params) {
    return this.set(params);
};

PrayTime.prototype.location = function(location) {
    return this.set({ location: location });
};

PrayTime.prototype.timezone = function(timezone) {
    return this.set({ timezone: timezone });
};

PrayTime.prototype.tune = function(tune) {
    return this.set({ tune: tune });
};

PrayTime.prototype.round = function(rounding) {
    if (typeof rounding === 'undefined') rounding = 'nearest';
    return this.set({ rounding: rounding });
};

PrayTime.prototype.format = function(format) {
    return this.set({ format: format });
};

PrayTime.prototype.set = function(settings) {
    var k;
    for (k in settings) {
        this.settings[k] = settings[k];
    }
    return this;
};

PrayTime.prototype.utcOffset = function(utcOffset) {
    if (typeof utcOffset === 'undefined') utcOffset = 'auto';
    if (typeof utcOffset === 'number' && Math.abs(utcOffset) < 16)
        utcOffset *= 60;
    this.set({ timezone: 'UTC' });
    return this.set({ utcOffset: utcOffset });
};


//---------------------- Getters ------------------------

PrayTime.prototype.times = function(date) {
    if (typeof date === 'undefined') date = 0;
    if (typeof date === 'number')
        date = new Date((date < 1000) ? Date.now() + date * 86400000 : date);
    if (date.constructor === Date)
        date = [date.getFullYear(), date.getMonth() + 1, date.getDate()];
    this.utcTime = Date.UTC(date[0], date[1] - 1, date[2]);

    var times = this.computeTimes();
    this.formatTimes(times);
    return times;
};

PrayTime.prototype.getTimes = function(date, location, timezone, dst, format) {
    if (typeof timezone === 'undefined') timezone = 'auto';
    if (typeof dst === 'undefined') dst = 0;
    if (typeof format === 'undefined') format = '24h';
    if (!location) return this.times(date);
    var utcOffset = (timezone == 'auto') ? timezone : timezone + dst;
    this.location(location).utcOffset(utcOffset).format(format);
    return this.times(date);
};


//---------------------- Compute Times -----------------------

PrayTime.prototype.computeTimes = function() {
    var times = {
        fajr: 5,
        sunrise: 6,
        dhuhr: 12,
        asr: 13,
        sunset: 18,
        maghrib: 18,
        isha: 18,
        midnight: 24
    };

    var i;
    for (i = 0; i < this.settings.iterations; i++)
        times = this.processTimes(times);

    this.adjustHighLats(times);
    this.updateTimes(times);
    this.tuneTimes(times);
    this.convertTimes(times);
    return times;
};

PrayTime.prototype.processTimes = function(times) {
    var params = this.settings;
    var horizon = 0.833;

    return {
        fajr: this.angleTime(params.fajr, times.fajr, -1),
        sunrise: this.angleTime(horizon, times.sunrise, -1),
        dhuhr: this.midDay(times.dhuhr),
        asr: this.angleTime(this.asrAngle(params.asr, times.asr), times.asr),
        sunset: this.angleTime(horizon, times.sunset),
        maghrib: this.angleTime(params.maghrib, times.maghrib),
        isha: this.angleTime(params.isha, times.isha),
        midnight: this.midDay(times.midnight) + 12
    };
};

PrayTime.prototype.updateTimes = function(times) {
    var params = this.settings;

    if (this.isMin(params.maghrib))
        times.maghrib = times.sunset + this.value(params.maghrib) / 60;
    if (this.isMin(params.isha))
        times.isha = times.maghrib + this.value(params.isha) / 60;
    if (params.midnight == 'Jafari') {
        var nextFajr = this.angleTime(params.fajr, 29, -1) + 24;
        times.midnight = (times.sunset + (this.adjusted ? times.fajr + 24 : nextFajr)) / 2;
    }
    times.dhuhr += this.value(params.dhuhr) / 60;
};

PrayTime.prototype.tuneTimes = function(times) {
    var mins = this.settings.tune;
    var i;
    for (i in times)
        if (i in mins)
            times[i] += mins[i] / 60;
};

PrayTime.prototype.convertTimes = function(times) {
    var lng = this.settings.location[1];
    var i;
    for (i in times) {
        var time = times[i] - lng / 15;
        var timestamp = this.utcTime + Math.floor(time * 3600000);
        times[i] = this.roundTime(timestamp);
    }
};

PrayTime.prototype.roundTime = function(timestamp) {
    var rounding = {
        up: 'ceil',
        down: 'floor',
        nearest: 'round'
    }[this.settings.rounding];
    if (!rounding)
        return timestamp;
    var OneMinute = 60000;
    return Math[rounding](timestamp / OneMinute) * OneMinute;
};


//---------------------- Calculation Functions -----------------------

PrayTime.prototype.sunPosition = function(time) {
    var lng = this.settings.location[1];
    var D = this.utcTime / 86400000 - 10957.5 + this.value(time) / 24 - lng / 360;

    var g = this.mod(357.529 + 0.98560028 * D, 360);
    var q = this.mod(280.459 + 0.98564736 * D, 360);
    var L = this.mod(q + 1.915 * this.sin(g) + 0.020 * this.sin(2 * g), 360);
    var e = 23.439 - 0.00000036 * D;
    var RA = this.mod(this.arctan2(this.cos(e) * this.sin(L), this.cos(L)) / 15, 24);

    return {
        declination: this.arcsin(this.sin(e) * this.sin(L)),
        equation: q / 15 - RA
    };
};

PrayTime.prototype.midDay = function(time) {
    var eqt = this.sunPosition(time).equation;
    var noon = this.mod(12 - eqt, 24);
    return noon;
};

PrayTime.prototype.angleTime = function(angle, time, direction) {
    if (typeof direction === 'undefined') direction = 1;
    var lat = this.settings.location[0];
    var decl = this.sunPosition(time).declination;
    var numerator = -this.sin(angle) - this.sin(lat) * this.sin(decl);
    var ratio = numerator / (this.cos(lat) * this.cos(decl));
    // Math.acos(out-of-range) returns NaN - same as JS, needed for
    // high-latitude fall-through into adjustHighLats().
    var diff = this.arccos(ratio) / 15;
    return this.midDay(time) + diff * direction;
};

PrayTime.prototype.asrAngle = function(asrParam, time) {
    var shadowFactor = { Standard: 1, Hanafi: 2 }[asrParam] || this.value(asrParam);
    var lat = this.settings.location[0];
    var decl = this.sunPosition(time).declination;
    return -this.arccot(shadowFactor + this.tan(Math.abs(lat - decl)));
};


//---------------------- Higher Latitudes -----------------------

PrayTime.prototype.adjustHighLats = function(times) {
    var params = this.settings;
    if (params.highLats == 'None')
        return;

    this.adjusted = false;
    var night = 24 + times.sunrise - times.sunset;

    var merged = {};
    var k;
    for (k in times) merged[k] = times[k];
    merged.fajr = this.adjustTime(times.fajr, times.sunrise, params.fajr, night, -1);
    merged.isha = this.adjustTime(times.isha, times.sunset, params.isha, night);
    merged.maghrib = this.adjustTime(times.maghrib, times.sunset, params.maghrib, night);
    for (k in merged) times[k] = merged[k];
};

PrayTime.prototype.adjustTime = function(time, base, angle, night, direction) {
    if (typeof direction === 'undefined') direction = 1;
    var factors = {
        NightMiddle: 1 / 2,
        OneSeventh: 1 / 7,
        AngleBased: 1 / 60 * this.value(angle)
    };
    var portion = factors[this.settings.highLats] * night;
    var timeDiff = (time - base) * direction;
    if (isNaN(time) || timeDiff > portion) {
        time = base + portion * direction;
        this.adjusted = true;
    }
    return time;
};


//---------------------- Formatting Functions ---------------------

PrayTime.prototype.formatTimes = function(times) {
    var i;
    for (i in times)
        times[i] = this.formatTime(times[i]);
};

PrayTime.prototype.formatTime = function(timestamp) {
    var format = this.settings.format;
    var InvalidTime = '-----';
    if (isNaN(timestamp))
        return InvalidTime;
    if (typeof format === 'function')
        return format(timestamp);
    if (format.toLowerCase() == 'x')
        return Math.floor(timestamp / ((format == 'X') ? 1000 : 1));
    // JScript has no Intl; fall back to UTC string. The background
    // runner uses format='X' (epoch seconds) so this path is not hit.
    return new Date(timestamp).toUTCString();
};


//---------------------- Misc Functions -----------------------

PrayTime.prototype.value = function(str) {
    return +String(str).split(/[^0-9.+-]/)[0];
};

PrayTime.prototype.isMin = function(str) {
    return String(str).indexOf('min') != -1;
};

PrayTime.prototype.mod = function(a, b) {
    return ((a % b) + b) % b;
};


//--------------------- Degree-Based Trigonometry -----------------

PrayTime.prototype.dtr = function(d) { return d * Math.PI / 180; };
PrayTime.prototype.rtd = function(r) { return r * 180 / Math.PI; };

PrayTime.prototype.sin = function(d) { return Math.sin(this.dtr(d)); };
PrayTime.prototype.cos = function(d) { return Math.cos(this.dtr(d)); };
PrayTime.prototype.tan = function(d) { return Math.tan(this.dtr(d)); };

PrayTime.prototype.arcsin = function(d) { return this.rtd(Math.asin(d)); };
PrayTime.prototype.arccos = function(d) { return this.rtd(Math.acos(d)); };
PrayTime.prototype.arctan = function(d) { return this.rtd(Math.atan(d)); };

PrayTime.prototype.arccot = function(x) { return this.rtd(Math.atan(1 / x)); };
PrayTime.prototype.arctan2 = function(y, x) { return this.rtd(Math.atan2(y, x)); };


//------------------------- Export (Node only) ------------------------

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PrayTime: PrayTime };
}
