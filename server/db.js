import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SEED_IMAGES, SEED_ROOMS, SEED_SETTINGS } from './seed-data.js';
import { hashPassword } from './auth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(here, '..', 'data'));
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'hotel.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  max_guests INTEGER NOT NULL DEFAULT 2,
  description TEXT NOT NULL DEFAULT '',
  features TEXT NOT NULL DEFAULT '[]',
  image TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL UNIQUE,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  nights INTEGER NOT NULL,
  guests INTEGER NOT NULL,
  price_per_night INTEGER NOT NULL,
  total INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  requests TEXT NOT NULL DEFAULT '',
  payment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL DEFAULT 'website',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS bookings_dates ON bookings(room_id, check_in, check_out);
CREATE TABLE IF NOT EXISTS blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
`);

// Statuses that occupy a room. Pending requests don't block public availability
// (so spam requests can't lock rooms); staff resolve them when confirming.
export const BLOCKING = ['confirmed', 'checked_in'];
export const STATUSES = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];
export const SOURCES = ['website', 'walk_in', 'phone', 'whatsapp', 'other'];

export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function getSettings() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'site'").get();
  return row ? JSON.parse(row.value) : structuredClone(SEED_SETTINGS);
}
export function saveSettings(s) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('site', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    JSON.stringify(s)
  );
}

export function roomFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    price: r.price,
    maxGuests: r.max_guests,
    description: r.description,
    features: JSON.parse(r.features || '[]'),
    image: r.image,
    active: !!r.active,
    sortOrder: r.sort_order,
  };
}

/** Bookings (blocking statuses) and blocks that overlap [checkIn, checkOut) for a room. */
export function findConflicts(roomId, checkIn, checkOut, excludeBookingId = 0) {
  const ph = BLOCKING.map(() => '?').join(',');
  const bookings = db
    .prepare(
      `SELECT id, ref, name, check_in, check_out, status FROM bookings
       WHERE room_id = ? AND id != ? AND status IN (${ph}) AND check_in < ? AND check_out > ?`
    )
    .all(roomId, excludeBookingId, ...BLOCKING, checkOut, checkIn);
  const blocks = db
    .prepare('SELECT id, start_date, end_date, reason FROM blocks WHERE room_id = ? AND start_date < ? AND end_date > ?')
    .all(roomId, checkOut, checkIn);
  return { bookings, blocks, any: bookings.length + blocks.length > 0 };
}

function seed() {
  const hasSettings = db.prepare("SELECT 1 FROM settings WHERE key = 'site'").get();
  if (!hasSettings) {
    saveSettings(SEED_SETTINGS);
    for (const f of SEED_IMAGES) {
      const src = path.join(here, 'seed-images', f);
      const dest = path.join(UPLOAD_DIR, f);
      if (fs.existsSync(src) && !fs.existsSync(dest)) fs.copyFileSync(src, dest);
    }
  }
  if (!db.prepare('SELECT 1 FROM rooms LIMIT 1').get()) {
    const ins = db.prepare(
      'INSERT INTO rooms (name, price, max_guests, description, features, image, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    SEED_ROOMS.forEach((r, i) => ins.run(r.name, r.price, r.max_guests, r.description, JSON.stringify(r.features), r.image, i));
  }
  if (!db.prepare('SELECT 1 FROM admins LIMIT 1').get()) {
    const username = (process.env.ADMIN_USERNAME || 'admin').trim();
    let password = process.env.ADMIN_PASSWORD;
    if (!password) {
      password = crypto.randomBytes(9).toString('base64url');
      const file = path.join(DATA_DIR, 'initial-admin-password.txt');
      fs.writeFileSync(file, `username: ${username}\npassword: ${password}\n\nLog in, change this password in Settings, then delete this file.\n`);
      console.log(`[setup] Created admin "${username}". The generated password is in ${file}`);
    } else {
      console.log(`[setup] Created admin "${username}" from ADMIN_PASSWORD.`);
    }
    db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(username, hashPassword(password));
  }
}
seed();
