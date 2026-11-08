import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BLOCKING, SOURCES, STATUSES, UPLOAD_DIR, db, findConflicts, getSettings, roomFromRow, saveSettings, tx } from '../db.js';
import { createSession, destroySession, hashPassword, requireAdmin, verifyPassword } from '../auth.js';
import { HttpError, sqlUtcToKE, addDays, isISODate, makeRef, nightsBetween, rateLimit, str, toWhatsApp, todayKE } from '../util.js';

export const adminRouter = express.Router();

// ───────── Auth ─────────
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Wait 15 minutes and try again.' });

adminRouter.post('/login', loginLimiter, (req, res) => {
  const username = str(req.body?.username, 60);
  const password = String(req.body?.password || '');
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  // Always run a hash comparison so response time doesn't reveal valid usernames.
  const ok = admin ? verifyPassword(password, admin.password_hash) : (verifyPassword(password, hashPassword('x')), false);
  if (!ok) return res.status(401).json({ error: 'Wrong username or password.' });
  createSession(db, res, admin.id);
  res.json({ username: admin.username });
});

const auth = requireAdmin(db);

adminRouter.post('/logout', auth, (req, res) => {
  destroySession(db, req, res);
  res.json({ ok: true });
});

adminRouter.get('/me', auth, (req, res) => res.json({ username: req.admin.username }));

adminRouter.post('/password', auth, (req, res) => {
  const { current, next } = req.body || {};
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!verifyPassword(String(current || ''), admin.password_hash)) throw new HttpError(400, 'Your current password is wrong.');
  if (typeof next !== 'string' || next.length < 8) throw new HttpError(400, 'The new password must be at least 8 characters.');
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hashPassword(next), admin.id);
  res.json({ ok: true });
});

// Everything below requires a session.
adminRouter.use(auth);

// ───────── Helpers ─────────
function bookingFromRow(r) {
  return {
    id: r.id,
    ref: r.ref,
    roomId: r.room_id,
    roomName: r.room_name,
    checkIn: r.check_in,
    checkOut: r.check_out,
    nights: r.nights,
    guests: r.guests,
    pricePerNight: r.price_per_night,
    total: r.total,
    amountPaid: r.amount_paid,
    balance: r.total - r.amount_paid,
    name: r.name,
    phone: r.phone,
    whatsapp: toWhatsApp(r.phone),
    email: r.email,
    requests: r.requests,
    payment: r.payment,
    status: r.status,
    source: r.source,
    notes: r.notes,
    createdAt: sqlUtcToKE(r.created_at), // Kenya time
    updatedAt: sqlUtcToKE(r.updated_at),
  };
}

const BOOKING_SELECT = 'SELECT b.*, r.name AS room_name FROM bookings b JOIN rooms r ON r.id = b.room_id';

function getBooking(id) {
  const row = db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).get(id);
  if (!row) throw new HttpError(404, 'Booking not found.');
  return row;
}

function conflictMessage(c) {
  const parts = [
    ...c.bookings.map((b) => `${b.ref} (${b.name}, ${b.check_in} → ${b.check_out})`),
    ...c.blocks.map((b) => `blocked ${b.start_date} → ${b.end_date}${b.reason ? ` (${b.reason})` : ''}`),
  ];
  return `This room is already taken for those dates: ${parts.join('; ')}.`;
}

/** Validate & normalise booking fields from the admin (create or merge-update). */
function normaliseBooking(input, existing) {
  const v = { ...existing };
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k);
  if (has('roomId')) v.room_id = Number(input.roomId);
  if (has('checkIn')) v.check_in = input.checkIn;
  if (has('checkOut')) v.check_out = input.checkOut;
  if (has('guests')) v.guests = Number(input.guests);
  for (const [k, max] of [['name', 120], ['phone', 30], ['email', 160], ['requests', 1000], ['payment', 80], ['notes', 4000]]) {
    if (has(k)) v[k] = str(input[k], max);
  }
  if (has('status')) v.status = input.status;
  if (has('source')) v.source = input.source;
  if (has('amountPaid')) v.amount_paid = Math.max(0, Math.round(Number(input.amountPaid) || 0));

  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(v.room_id);
  if (!room) throw new HttpError(400, 'Choose a room.');
  if (!isISODate(v.check_in) || !isISODate(v.check_out)) throw new HttpError(400, 'Choose valid dates.');
  v.nights = nightsBetween(v.check_in, v.check_out);
  if (v.nights < 1) throw new HttpError(400, 'Check-out must be after check-in.');
  if (v.nights > 365) throw new HttpError(400, 'Stay is too long.');
  if (!Number.isInteger(v.guests) || v.guests < 1 || v.guests > room.max_guests) {
    throw new HttpError(400, `The ${room.name} sleeps up to ${room.max_guests} guests.`);
  }
  if (!v.name || v.name.length < 2) throw new HttpError(400, 'Enter the guest name.');
  if (!v.phone) throw new HttpError(400, 'Enter the guest phone number.');
  if (!STATUSES.includes(v.status)) throw new HttpError(400, 'Unknown status.');
  if (!SOURCES.includes(v.source)) throw new HttpError(400, 'Unknown booking source.');

  // Price per night: an explicit staff override wins; a new booking or a room
  // change takes the room's current price; otherwise the agreed rate is kept.
  if (has('pricePerNight') && input.pricePerNight !== '' && input.pricePerNight !== null) {
    const p = Math.round(Number(input.pricePerNight));
    if (!(p >= 0)) throw new HttpError(400, 'Price per night must be a number.');
    v.price_per_night = p;
  } else if (!existing.id || existing.room_id !== v.room_id) {
    v.price_per_night = room.price;
  }
  v.total = v.price_per_night * v.nights;
  return v;
}

// ───────── Dashboard ─────────
adminRouter.get('/dashboard', (req, res) => {
  const today = todayKE();
  const monthStart = today.slice(0, 8) + '01';
  const nextMonth = (() => {
    const [y, m] = today.split('-').map(Number);
    return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  })();
  const ph = BLOCKING.map(() => '?').join(',');
  const list = (sql, ...args) => db.prepare(`${BOOKING_SELECT} ${sql}`).all(...args).map(bookingFromRow);

  const activeRooms = db.prepare('SELECT COUNT(*) n FROM rooms WHERE active = 1').get().n;
  const occupied = db
    .prepare(`SELECT COUNT(DISTINCT room_id) n FROM bookings WHERE status IN (${ph}) AND check_in <= ? AND check_out > ?`)
    .get(...BLOCKING, today, today).n;
  const month = db
    .prepare(
      `SELECT COALESCE(SUM(total),0) booked, COALESCE(SUM(amount_paid),0) paid, COALESCE(SUM(nights),0) nights, COUNT(*) n
       FROM bookings WHERE status IN ('confirmed','checked_in','checked_out') AND check_in >= ? AND check_in < ?`
    )
    .get(monthStart, nextMonth);
  const outstanding = db
    .prepare(`SELECT COALESCE(SUM(total - amount_paid),0) n FROM bookings WHERE status IN ('confirmed','checked_in','checked_out') AND total > amount_paid`)
    .get().n;

  res.json({
    today,
    stats: {
      pending: db.prepare("SELECT COUNT(*) n FROM bookings WHERE status = 'pending'").get().n,
      inHouse: db.prepare("SELECT COUNT(*) n FROM bookings WHERE status = 'checked_in'").get().n,
      occupied,
      activeRooms,
      monthBooked: month.booked,
      monthPaid: month.paid,
      monthNights: month.nights,
      monthBookings: month.n,
      outstanding,
    },
    arrivals: list("WHERE b.check_in = ? AND b.status IN ('pending','confirmed') ORDER BY b.created_at", today),
    departures: list("WHERE b.check_out = ? AND b.status IN ('confirmed','checked_in') ORDER BY b.room_id", today),
    upcoming: list(
      "WHERE b.check_in > ? AND b.check_in <= ? AND b.status IN ('pending','confirmed') ORDER BY b.check_in",
      today,
      addDays(today, 7)
    ),
    pending: list("WHERE b.status = 'pending' ORDER BY b.created_at DESC LIMIT 10"),
  });
});

// ───────── Bookings ─────────
adminRouter.get('/bookings', (req, res) => {
  const where = [];
  const args = [];
  const { status, q, from, to, roomId } = req.query;
  if (status && status !== 'all') {
    if (status === 'active') where.push("b.status IN ('pending','confirmed','checked_in')");
    else if (STATUSES.includes(status)) (where.push('b.status = ?'), args.push(status));
  }
  if (roomId) (where.push('b.room_id = ?'), args.push(Number(roomId)));
  if (isISODate(from)) (where.push('b.check_out > ?'), args.push(from));
  if (isISODate(to)) (where.push('b.check_in <= ?'), args.push(to));
  if (q) {
    where.push('(b.ref LIKE ? OR b.name LIKE ? OR b.phone LIKE ? OR b.email LIKE ?)');
    const like = `%${String(q).slice(0, 60)}%`;
    args.push(like, like, like, like);
  }
  const sql = `${BOOKING_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY b.check_in DESC, b.id DESC LIMIT 500`;
  const rows = db.prepare(sql).all(...args).map(bookingFromRow);
  // Flag pending requests that clash with a confirmed booking or block.
  for (const b of rows) {
    if (b.status === 'pending') b.conflict = findConflicts(b.roomId, b.checkIn, b.checkOut, b.id).any;
  }
  res.json(rows);
});

function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

adminRouter.get('/bookings.csv', (req, res) => {
  const rows = db.prepare(`${BOOKING_SELECT} ORDER BY b.check_in DESC`).all().map(bookingFromRow);
  const cols = ['ref', 'status', 'source', 'roomName', 'checkIn', 'checkOut', 'nights', 'guests', 'pricePerNight', 'total', 'amountPaid', 'balance', 'name', 'phone', 'email', 'payment', 'requests', 'notes', 'createdAt'];
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="bookings-${todayKE()}.csv"`);
  res.send('﻿' + csv);
});

adminRouter.get('/bookings/:id', (req, res) => {
  const b = bookingFromRow(getBooking(Number(req.params.id)));
  const c = findConflicts(b.roomId, b.checkIn, b.checkOut, b.id);
  res.json({ ...b, conflicts: c.any ? conflictMessage(c) : null });
});

adminRouter.post('/bookings', (req, res) => {
  const result = tx(() => {
    const v = normaliseBooking(req.body || {}, {
      status: 'confirmed', source: 'walk_in', email: '', requests: '', payment: '', notes: '', amount_paid: 0,
    });
    if (BLOCKING.includes(v.status)) {
      const c = findConflicts(v.room_id, v.check_in, v.check_out);
      if (c.any) throw new HttpError(409, conflictMessage(c));
    }
    let ref;
    do ref = makeRef();
    while (db.prepare('SELECT 1 FROM bookings WHERE ref = ?').get(ref));
    const info = db
      .prepare(
        `INSERT INTO bookings (ref, room_id, check_in, check_out, nights, guests, price_per_night, total, amount_paid, name, phone, email, requests, payment, status, source, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(ref, v.room_id, v.check_in, v.check_out, v.nights, v.guests, v.price_per_night, v.total, v.amount_paid, v.name, v.phone, v.email, v.requests, v.payment, v.status, v.source, v.notes);
    return bookingFromRow(getBooking(Number(info.lastInsertRowid)));
  });
  res.status(201).json(result);
});

adminRouter.patch('/bookings/:id', (req, res) => {
  const result = tx(() => {
    const existing = getBooking(Number(req.params.id));
    const v = normaliseBooking(req.body || {}, existing);
    if (BLOCKING.includes(v.status)) {
      const c = findConflicts(v.room_id, v.check_in, v.check_out, existing.id);
      if (c.any) throw new HttpError(409, conflictMessage(c));
    }
    db.prepare(
      `UPDATE bookings SET room_id=?, check_in=?, check_out=?, nights=?, guests=?, price_per_night=?, total=?, amount_paid=?,
       name=?, phone=?, email=?, requests=?, payment=?, status=?, source=?, notes=?, updated_at=datetime('now') WHERE id=?`
    ).run(v.room_id, v.check_in, v.check_out, v.nights, v.guests, v.price_per_night, v.total, v.amount_paid, v.name, v.phone, v.email, v.requests, v.payment, v.status, v.source, v.notes, existing.id);
    return bookingFromRow(getBooking(existing.id));
  });
  res.json(result);
});

// ───────── Calendar & blocks ─────────
adminRouter.get('/calendar', (req, res) => {
  const from = isISODate(req.query.from) ? req.query.from : todayKE();
  const days = Math.min(62, Math.max(1, Number(req.query.days) || 14));
  const to = addDays(from, days);
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY sort_order, id').all().map(roomFromRow);
  const bookings = db
    .prepare(`${BOOKING_SELECT} WHERE b.status NOT IN ('cancelled','no_show','checked_out') AND b.check_in < ? AND b.check_out > ?`)
    .all(to, from)
    .map(bookingFromRow);
  const blocks = db.prepare('SELECT * FROM blocks WHERE start_date < ? AND end_date > ? ORDER BY start_date').all(to, from);
  res.json({ from, days, rooms, bookings, blocks });
});

adminRouter.get('/blocks', (req, res) => {
  res.json(
    db
      .prepare('SELECT bl.*, r.name AS room_name FROM blocks bl JOIN rooms r ON r.id = bl.room_id WHERE bl.end_date > ? ORDER BY bl.start_date')
      .all(todayKE())
  );
});

adminRouter.post('/blocks', (req, res) => {
  const { roomId, startDate, endDate } = req.body || {};
  const reason = str(req.body?.reason, 200);
  if (!db.prepare('SELECT 1 FROM rooms WHERE id = ?').get(Number(roomId))) throw new HttpError(400, 'Choose a room.');
  if (!isISODate(startDate) || !isISODate(endDate) || endDate <= startDate) {
    throw new HttpError(400, 'The end date must be after the start date.');
  }
  const info = db
    .prepare('INSERT INTO blocks (room_id, start_date, end_date, reason) VALUES (?, ?, ?, ?)')
    .run(Number(roomId), startDate, endDate, reason);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

adminRouter.delete('/blocks/:id', (req, res) => {
  db.prepare('DELETE FROM blocks WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ───────── Rooms ─────────
function normaliseRoom(b) {
  const name = str(b.name, 80);
  const price = Math.round(Number(b.price));
  const maxGuests = Math.round(Number(b.maxGuests));
  if (name.length < 2) throw new HttpError(400, 'Enter a room name.');
  if (!(price > 0)) throw new HttpError(400, 'Enter a price per night.');
  if (!(maxGuests >= 1 && maxGuests <= 12)) throw new HttpError(400, 'Max guests must be between 1 and 12.');
  const features = Array.isArray(b.features) ? b.features.map((f) => str(f, 40)).filter(Boolean).slice(0, 12) : [];
  const image = str(b.image, 300);
  if (image && !image.startsWith('/uploads/')) throw new HttpError(400, 'Upload the photo from the room form.');
  return {
    name, price, maxGuests, features, image,
    description: str(b.description, 600),
    active: b.active === false ? 0 : 1,
    sortOrder: Math.round(Number(b.sortOrder) || 0),
  };
}

adminRouter.get('/rooms', (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, (SELECT COUNT(*) FROM bookings b WHERE b.room_id = r.id) AS booking_count FROM rooms r ORDER BY r.sort_order, r.id`
    )
    .all();
  res.json(rows.map((r) => ({ ...roomFromRow(r), bookingCount: r.booking_count })));
});

adminRouter.post('/rooms', (req, res) => {
  const r = normaliseRoom(req.body || {});
  const info = db
    .prepare('INSERT INTO rooms (name, price, max_guests, description, features, image, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(r.name, r.price, r.maxGuests, r.description, JSON.stringify(r.features), r.image, r.active, r.sortOrder);
  res.status(201).json(roomFromRow(db.prepare('SELECT * FROM rooms WHERE id = ?').get(Number(info.lastInsertRowid))));
});

adminRouter.put('/rooms/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM rooms WHERE id = ?').get(id)) throw new HttpError(404, 'Room not found.');
  const r = normaliseRoom(req.body || {});
  db.prepare('UPDATE rooms SET name=?, price=?, max_guests=?, description=?, features=?, image=?, active=?, sort_order=? WHERE id=?').run(
    r.name, r.price, r.maxGuests, r.description, JSON.stringify(r.features), r.image, r.active, r.sortOrder, id
  );
  res.json(roomFromRow(db.prepare('SELECT * FROM rooms WHERE id = ?').get(id)));
});

adminRouter.delete('/rooms/:id', (req, res) => {
  const id = Number(req.params.id);
  if (db.prepare('SELECT 1 FROM bookings WHERE room_id = ? LIMIT 1').get(id)) {
    throw new HttpError(409, 'This room has bookings, so it can’t be deleted. Hide it from the website instead.');
  }
  db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ───────── Settings ─────────
adminRouter.get('/settings', (req, res) => res.json(getSettings()));

const HOTEL_FIELDS = ['name', 'town', 'location', 'addressNote', 'phoneDisplay', 'whatsapp', 'email', 'checkIn', 'checkOut', 'mapsUrl'];
const ICONS = ['wifi', 'dining', 'parking', 'shower', 'events', 'clock', 'bed', 'heart', 'pin', 'phone', 'mail', 'users', 'calendar', 'check'];
const uploadPath = (s) => (typeof s === 'string' && s.startsWith('/uploads/') ? s.slice(0, 300) : '');

adminRouter.put('/settings', (req, res) => {
  const b = req.body || {};
  const cur = getSettings();
  const hotel = { ...cur.hotel };
  for (const k of HOTEL_FIELDS) if (b.hotel && k in b.hotel) hotel[k] = str(b.hotel[k], 300);
  hotel.whatsapp = hotel.whatsapp.replace(/[^\d]/g, '');
  if (!/^\d{9,15}$/.test(hotel.whatsapp)) throw new HttpError(400, 'WhatsApp number must be in international format, like 254700262745.');
  if (hotel.mapsUrl && !/^https:\/\//.test(hotel.mapsUrl)) throw new HttpError(400, 'The map link must start with https://');
  if (hotel.name.length < 2) throw new HttpError(400, 'Enter the hotel name.');

  const amenities = Array.isArray(b.amenities)
    ? b.amenities.slice(0, 24).map((a) => ({ icon: ICONS.includes(a.icon) ? a.icon : 'check', title: str(a.title, 60), text: str(a.text, 160) })).filter((a) => a.title)
    : cur.amenities;
  const paymentMethods = Array.isArray(b.paymentMethods)
    ? b.paymentMethods.map((p) => str(p, 60)).filter(Boolean).slice(0, 10)
    : cur.paymentMethods;
  if (!paymentMethods.length) throw new HttpError(400, 'Add at least one payment method.');
  const cs = b.comingSoon || cur.comingSoon || {};
  const comingSoon = {
    enabled: !!cs.enabled,
    price: Math.max(0, Math.round(Number(cs.price) || 0)),
    title: str(cs.title, 80),
    text: str(cs.text, 300),
  };
  const gallery = Array.isArray(b.gallery)
    ? b.gallery.slice(0, 24).map((g) => ({ src: uploadPath(g.src), alt: str(g.alt, 160) })).filter((g) => g.src)
    : cur.gallery;
  const images = {
    hero: uploadPath(b.images?.hero) || cur.images.hero,
    about: uploadPath(b.images?.about) || cur.images.about,
  };
  const next = { hotel, amenities, paymentMethods, comingSoon, gallery, images };
  saveSettings(next);
  res.json(next);
});

// ───────── Uploads ─────────
const MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + MIME[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
  fileFilter: (req, file, cb) => cb(MIME[file.mimetype] ? null : new HttpError(400, 'Upload a JPG, PNG or WebP image.'), !!MIME[file.mimetype]),
});

adminRouter.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (req.file) fs.rm(path.join(UPLOAD_DIR, req.file.filename), { force: true }, () => {});
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Images must be 5 MB or smaller.' : err.message;
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
    res.status(201).json({ url: '/uploads/' + req.file.filename });
  });
});
