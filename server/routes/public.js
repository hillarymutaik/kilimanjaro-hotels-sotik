import express from 'express';
import { db, findConflicts, getSettings, roomFromRow, tx } from '../db.js';
import { HttpError, isISODate, isKenyanPhone, makeRef, nightsBetween, rateLimit, str, todayKE } from '../util.js';

export const publicRouter = express.Router();

/** Everything the public site needs to render. */
publicRouter.get('/site', (req, res) => {
  const s = getSettings();
  const rooms = db
    .prepare('SELECT * FROM rooms WHERE active = 1 ORDER BY sort_order, id')
    .all()
    .map(roomFromRow);
  res.json({ ...s, comingSoon: s.comingSoon?.enabled ? s.comingSoon : null, rooms, today: todayKE() });
});

/** Room ids unavailable for a date range. Never exposes guest details. */
publicRouter.get('/availability', (req, res) => {
  const { checkIn, checkOut } = req.query;
  if (!isISODate(checkIn) || !isISODate(checkOut) || checkOut <= checkIn) {
    return res.status(400).json({ error: 'Choose valid dates.' });
  }
  const rooms = db.prepare('SELECT id FROM rooms WHERE active = 1').all();
  const unavailable = rooms.filter((r) => findConflicts(r.id, checkIn, checkOut).any).map((r) => r.id);
  res.json({ unavailable });
});

const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many booking requests from this connection. Please call or WhatsApp the hotel.',
});

publicRouter.post('/bookings', bookingLimiter, (req, res) => {
  const b = req.body || {};
  const roomId = Number(b.roomId);
  const checkIn = b.checkIn;
  const checkOut = b.checkOut;
  const guests = Number(b.guests);
  const name = str(b.name, 120);
  const phone = str(b.phone, 30);
  const email = str(b.email, 160);
  const requests = str(b.requests, 1000);
  const settings = getSettings();
  const payment = settings.paymentMethods.includes(b.payment) ? b.payment : settings.paymentMethods[0] || '';

  if (!isISODate(checkIn) || !isISODate(checkOut)) throw new HttpError(400, 'Choose valid dates.');
  if (checkIn < todayKE()) throw new HttpError(400, 'Check-in cannot be in the past.');
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) throw new HttpError(400, 'Check-out must be after check-in.');
  if (nights > 60) throw new HttpError(400, 'For stays longer than 60 nights, please contact the hotel.');
  if (name.length < 2) throw new HttpError(400, 'Enter your full name.');
  if (!isKenyanPhone(phone)) throw new HttpError(400, 'Enter a valid Kenyan phone number, like 0712 345 678.');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Check your email address, or leave it blank.');

  const result = tx(() => {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND active = 1').get(roomId);
    if (!room) throw new HttpError(404, 'That room is no longer available.');
    if (!Number.isInteger(guests) || guests < 1 || guests > room.max_guests) {
      throw new HttpError(400, `The ${room.name} sleeps up to ${room.max_guests} guests.`);
    }
    if (findConflicts(room.id, checkIn, checkOut).any) {
      throw new HttpError(409, `Sorry, the ${room.name} is already booked for some of those dates. Try other dates or another room.`);
    }
    // Price is always computed here, never taken from the client.
    const total = room.price * nights;
    let ref;
    do ref = makeRef();
    while (db.prepare('SELECT 1 FROM bookings WHERE ref = ?').get(ref));
    db.prepare(
      `INSERT INTO bookings (ref, room_id, check_in, check_out, nights, guests, price_per_night, total, name, phone, email, requests, payment, status, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'website')`
    ).run(ref, room.id, checkIn, checkOut, nights, guests, room.price, total, name, phone, email, requests, payment);
    return { ref, roomName: room.name, checkIn, checkOut, nights, guests, pricePerNight: room.price, total, name, phone, email, requests, payment };
  });
  res.status(201).json(result);
});
