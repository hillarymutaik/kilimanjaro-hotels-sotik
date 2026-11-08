// Date helpers that work in LOCAL time. Using toISOString() would give a UTC
// date, which in Kenya (UTC+3) is "yesterday" between midnight and 3 AM.

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseISODate(s);
  if (!d || isNaN(d)) return '';
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function todayISO() {
  return toISODate(new Date());
}

export function nightsBetween(checkIn, checkOut) {
  const a = parseISODate(checkIn);
  const b = parseISODate(checkOut);
  if (!a || !b) return 0;
  // Round to absorb any daylight-saving hour difference.
  return Math.round((b - a) / 86400000);
}

export function formatDate(s) {
  const d = parseISODate(s);
  if (!d) return '';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function kes(n) {
  return 'KES ' + n.toLocaleString('en-KE');
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function makeRef() {
  return 'KHS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function isKenyanPhone(raw) {
  const ph = raw.replace(/[\s-]/g, '');
  return /^(\+?254|0)[17]\d{8}$/.test(ph);
}
