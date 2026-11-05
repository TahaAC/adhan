// hijri.ts - Convert Gregorian dates to Hijri (Islamic) dates.
//
// Uses the built-in Intl API with the "islamic" calendar. Returns both the
// formatted date string and the numeric components so the UI can render
// them flexibly. Falls back gracefully when the runtime lacks the
// islamic calendar (older Safari builds).

export interface HijriDate {
  day: number;
  month: number; // 1-12
  year: number;
  monthName: string;
  formatted: string; // e.g. "15 Rabi al-Awwal 1447 AH"
  formattedArabic: string; // e.g. "١٥ ربيع الأول ١٤٤٧ هـ"
}

const HIJRI_MONTHS_EN = [
  'Muharram',
  'Safar',
  "Rabi al-Awwal",
  "Rabi al-Thani",
  'Jumada al-Ula',
  'Jumada al-Thani',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qi'dah",
  'Dhu al-Hijjah',
];

const HIJRI_MONTHS_AR = [
  'محرّم',
  'صفر',
  'ربيع الأول',
  'ربيع الثاني',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوّال',
  'ذو القعدة',
  'ذو الحجّة',
];

function toArabicNumerals(num: number | string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/\d/g, (d) => arabicDigits[+d]);
}

export function getHijriDate(date: Date = new Date()): HijriDate {
  let day = 1;
  let month = 1;
  let year = 1447;

  try {
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    const parts = formatter.formatToParts(date);
    for (const p of parts) {
      if (p.type === 'day') day = parseInt(p.value, 10);
      else if (p.type === 'month') month = parseInt(p.value, 10);
      else if (p.type === 'year') year = parseInt(p.value, 10);
    }
  } catch {
    // Fallback: very rough estimate using average year length (354.367 days).
    const epoch = new Date(622, 6, 16).getTime();
    const days = Math.floor((date.getTime() - epoch) / 86400000);
    year = Math.floor((days / 354.367) + 1);
    const dayOfYear = Math.floor(days % 354.367);
    month = Math.min(12, Math.floor(dayOfYear / 29.5) + 1);
    day = Math.max(1, dayOfYear - Math.floor((month - 1) * 29.5));
  }

  const monthName = HIJRI_MONTHS_EN[month - 1] || 'Muharram';
  const monthNameAr = HIJRI_MONTHS_AR[month - 1] || 'محرّم';

  return {
    day,
    month,
    year,
    monthName,
    formatted: `${day} ${monthName} ${year} AH`,
    formattedArabic: `${toArabicNumerals(day)} ${monthNameAr} ${toArabicNumerals(
      year,
    )} هـ`,
  };
}

export function formatGregorian(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
