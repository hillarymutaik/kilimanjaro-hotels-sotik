// Shared helpers: dates in hotel local time, validation, small rate limiter.
import crypto from 'node:crypto';

export const TZ = 'Africa/Nairobi';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in Kenya as YYYY-MM-DD, whatever the server's own timezone. */
export function todayKE(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** SQLite UTC "YYYY-MM-DD HH:MM:SS" → Kenya local "YYYY-MM-DD HH:MM". */
export function sqlUtcToKE(s) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T") + "Z");
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

export function isISODate(s) {
  if (typeof s !== 'string' || !ISO.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function nightsBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function isKenyanPhone(raw) {
  return /^(\+?254|0)[17]\d{8}$/.test(String(raw || '').replace(/[\s-]/g, ''));
}

/** 07XX… / +2547XX… → 2547XX… for wa.me links. */
export function toWhatsApp(raw) {
  const p = String(raw || '').replace(/[^\d]/g, '');
  if (p.startsWith('0')) return '254' + p.slice(1);
  return p;
}

export function makeRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (const b of crypto.randomBytes(6)) s += chars[b % chars.length];
  return 'KHS-' + s;
}

export function str(v, max = 500) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Fixed-window in-memory rate limiter keyed by IP. */
export function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) h = { count: 0, reset: now + windowMs };
    h.count++;
    hits.set(key, h);
    if (h.count > max) return res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
    next();
  };
}
