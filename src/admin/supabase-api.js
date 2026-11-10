// The admin API (same routes and response shapes as server/routes/admin.js), backed by Supabase.
// Access is enforced by the database (supabase/schema.sql): only users listed in public.admins
// can read or change anything, and the bookings trigger blocks double bookings.
import { check, supabase, todayKE } from '../lib/supabase.js';

const STATUSES = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'];
const SOURCES = ['website', 'walk_in', 'phone', 'whatsapp', 'other'];
const BOOKING_SELECT = '*, rooms(name)';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (message) => new ApiError(400, message);

const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().startsWith(s);
const addDays = (s, n) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const nightsBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const toWhatsApp = (raw) => {
  const p = String(raw || '').replace(/[^\d]/g, '');
  return p.startsWith('0') ? '254' + p.slice(1) : p;
};
function makeRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'KHS-' + Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
/** ISO timestamp → Kenya local "YYYY-MM-DD HH:MM". */
function toKE(ts) {
  if (!ts) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ts))
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

function bookingFromRow(r) {
  return {
    id: r.id,
    ref: r.ref,
    roomId: r.room_id,
    roomName: r.rooms?.name ?? '',
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
    createdAt: toKE(r.created_at),
    updatedAt: toKE(r.updated_at),
  };
}

function roomFromRow(r) {
  return {
    id: r.id,
    name: r.name,
    price: r.price,
    maxGuests: r.max_guests,
    description: r.description,
    features: Array.isArray(r.features) ? r.features : [],
    image: r.image,
    active: !!r.active,
    sortOrder: r.sort_order,
  };
}

async function pendingClashes() {
  return new Set(check(await supabase.rpc('pending_clashes')) || []);
}
async function withClashFlags(rows) {
  if (!rows.some((b) => b.status === 'pending')) return rows;
  const clash = await pendingClashes();
  for (const b of rows) if (b.status === 'pending') b.conflict = clash.has(b.id);
  return rows;
}

// ───────── Auth ─────────
async function requireAdmin() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new ApiError(401, 'Please log in.');
  const isAdmin = check(await supabase.rpc('is_admin'));
  if (!isAdmin) {
    await supabase.auth.signOut();
    throw new ApiError(401, 'This account is not allowed to use the admin panel.');
  }
  return data.session.user;
}

async function login({ username, password }) {
  const email = str(username, 160);
  if (!email.includes('@')) throw bad('Sign in with your email address.');
  const { error } = await supabase.auth.signInWithPassword({ email, password: String(password || '') });
  if (error) throw new ApiError(400, 'Wrong email or password.');
  const user = await requireAdmin().catch((e) => {
    throw new ApiError(400, e.message);
  });
  return { username: user.email };
}

async function changePassword({ current, next }) {
  const user = await requireAdmin();
  if (typeof next !== 'string' || next.length < 8) throw bad('The new password must be at least 8 characters.');
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: String(current || '') });
  if (error) throw bad('Your current password is wrong.');
  check(await supabase.auth.updateUser({ password: next }));
  return { ok: true };
}

// ───────── Bookings ─────────
async function getRawBooking(id) {
  const row = check(await supabase.from('bookings').select(BOOKING_SELECT).eq('id', id).maybeSingle());
  if (!row) throw new ApiError(404, 'Booking not found.');
  return row;
}

/** Validate and normalise booking fields from the admin (create, or merge into an existing row). */
async function normaliseBooking(input, existing) {
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

  const room = v.room_id ? check(await supabase.from('rooms').select('*').eq('id', v.room_id).maybeSingle()) : null;
  if (!room) throw bad('Choose a room.');
  if (!isISODate(v.check_in) || !isISODate(v.check_out)) throw bad('Choose valid dates.');
  v.nights = nightsBetween(v.check_in, v.check_out);
  if (v.nights < 1) throw bad('Check-out must be after check-in.');
  if (v.nights > 365) throw bad('Stay is too long.');
  if (!Number.isInteger(v.guests) || v.guests < 1 || v.guests > room.max_guests) {
    throw bad(`The ${room.name} sleeps up to ${room.max_guests} guests.`);
  }
  if (!v.name || v.name.length < 2) throw bad('Enter the guest name.');
  if (!v.phone) throw bad('Enter the guest phone number.');
  if (!STATUSES.includes(v.status)) throw bad('Unknown status.');
  if (!SOURCES.includes(v.source)) throw bad('Unknown booking source.');

  // Price per night: an explicit staff override wins; a new booking or a room change
  // takes the room's current price; otherwise the agreed rate is kept.
  if (has('pricePerNight') && input.pricePerNight !== '' && input.pricePerNight !== null) {
    const p = Math.round(Number(input.pricePerNight));
    if (!(p >= 0)) throw bad('Price per night must be a number.');
    v.price_per_night = p;
  } else if (!existing.id || existing.room_id !== v.room_id) {
    v.price_per_night = room.price;
  }
  v.total = v.price_per_night * v.nights;
  return v;
}

const WRITABLE = ['room_id', 'check_in', 'check_out', 'nights', 'guests', 'price_per_night', 'total', 'amount_paid', 'name', 'phone', 'email', 'requests', 'payment', 'status', 'source', 'notes'];
const pick = (v) => Object.fromEntries(WRITABLE.map((k) => [k, v[k]]));

async function createBooking(body) {
  const v = await normaliseBooking(body, { status: 'confirmed', source: 'walk_in', email: '', requests: '', payment: '', notes: '', amount_paid: 0 });
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await supabase.from('bookings').insert({ ...pick(v), ref: makeRef() }).select(BOOKING_SELECT).single();
    if (res.error?.code === '23505') continue; // reference already used: try another
    return bookingFromRow(check(res));
  }
  throw new Error('Could not create a booking reference. Please try again.');
}

async function updateBooking(id, body) {
  const existing = await getRawBooking(id);
  const v = await normaliseBooking(body, existing);
  return bookingFromRow(check(await supabase.from('bookings').update(pick(v)).eq('id', id).select(BOOKING_SELECT).single()));
}

async function listBookings(params) {
  const status = params.get('status');
  const q = params.get('q');
  let query = supabase.from('bookings').select(BOOKING_SELECT);
  if (status && status !== 'all') {
    if (status === 'active') query = query.in('status', ['pending', 'confirmed', 'checked_in']);
    else if (STATUSES.includes(status)) query = query.eq('status', status);
  }
  if (params.get('roomId')) query = query.eq('room_id', Number(params.get('roomId')));
  if (isISODate(params.get('from'))) query = query.gt('check_out', params.get('from'));
  if (isISODate(params.get('to'))) query = query.lte('check_in', params.get('to'));
  if (q) {
    // Characters with meaning in the filter syntax are dropped.
    const safe = q.slice(0, 60).replace(/[,()*%\\:"']/g, ' ').trim();
    if (safe) query = query.or(['ref', 'name', 'phone', 'email'].map((c) => `${c}.ilike.*${safe}*`).join(','));
  }
  const rows = check(await query.order('check_in', { ascending: false }).order('id', { ascending: false }).limit(500));
  return withClashFlags(rows.map(bookingFromRow));
}

function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function bookingsCsv() {
  await requireAdmin();
  // Supabase returns at most 1000 rows per request, so fetch page by page.
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const page = check(
      await supabase.from('bookings').select(BOOKING_SELECT).order('check_in', { ascending: false }).order('id').range(from, from + 999)
    );
    rows.push(...page.map(bookingFromRow));
    if (page.length < 1000) break;
  }
  const cols = ['ref', 'status', 'source', 'roomName', 'checkIn', 'checkOut', 'nights', 'guests', 'pricePerNight', 'total', 'amountPaid', 'balance', 'name', 'phone', 'email', 'payment', 'requests', 'notes', 'createdAt'];
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n');
}

// ───────── Dashboard ─────────
async function dashboard() {
  const today = todayKE();
  const monthStart = today.slice(0, 8) + '01';
  const [y, m] = today.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const DONE = ['confirmed', 'checked_in', 'checked_out'];

  const [active, month, owing, rooms, clash] = await Promise.all([
    supabase.from('bookings').select(BOOKING_SELECT).in('status', ['pending', 'confirmed', 'checked_in']).then(check),
    supabase.from('bookings').select('total, amount_paid, nights').in('status', DONE).gte('check_in', monthStart).lt('check_in', nextMonth).then(check),
    supabase.from('bookings').select('balance').in('status', DONE).gt('balance', 0).then(check),
    supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('active', true),
    pendingClashes(),
  ]);
  if (rooms.error) throw new Error(rooms.error.message);
  const list = active.map(bookingFromRow);
  for (const b of list) if (b.status === 'pending') b.conflict = clash.has(b.id);
  const blocking = list.filter((b) => b.status === 'confirmed' || b.status === 'checked_in');
  const by = (key, dir = 1) => (a, b) => (a[key] < b[key] ? -dir : a[key] > b[key] ? dir : 0);
  const sum = (arr, k) => arr.reduce((t, r) => t + (r[k] || 0), 0);

  return {
    today,
    stats: {
      pending: list.filter((b) => b.status === 'pending').length,
      inHouse: list.filter((b) => b.status === 'checked_in').length,
      occupied: new Set(blocking.filter((b) => b.checkIn <= today && b.checkOut > today).map((b) => b.roomId)).size,
      activeRooms: rooms.count || 0,
      monthBooked: sum(month, 'total'),
      monthPaid: sum(month, 'amount_paid'),
      monthNights: sum(month, 'nights'),
      monthBookings: month.length,
      outstanding: sum(owing, 'balance'),
    },
    arrivals: list.filter((b) => b.checkIn === today && ['pending', 'confirmed'].includes(b.status)).sort(by('createdAt')),
    departures: blocking.filter((b) => b.checkOut === today).sort(by('roomId')),
    upcoming: list
      .filter((b) => b.checkIn > today && b.checkIn <= addDays(today, 7) && ['pending', 'confirmed'].includes(b.status))
      .sort(by('checkIn')),
    pending: list.filter((b) => b.status === 'pending').sort(by('createdAt', -1)).slice(0, 10),
  };
}

// ───────── Calendar & blocks ─────────
async function calendar(params) {
  const from = isISODate(params.get('from')) ? params.get('from') : todayKE();
  const days = Math.min(62, Math.max(1, Number(params.get('days')) || 14));
  const to = addDays(from, days);
  const [rooms, bookings, blocks] = await Promise.all([
    supabase.from('rooms').select('*').order('sort_order').order('id').then(check),
    supabase.from('bookings').select(BOOKING_SELECT).not('status', 'in', '(cancelled,no_show,checked_out)').lt('check_in', to).gt('check_out', from).then(check),
    supabase.from('blocks').select('*').lt('start_date', to).gt('end_date', from).order('start_date').then(check),
  ]);
  return { from, days, rooms: rooms.map(roomFromRow), bookings: bookings.map(bookingFromRow), blocks };
}

async function listBlocks() {
  const rows = check(await supabase.from('blocks').select('*, rooms(name)').gt('end_date', todayKE()).order('start_date'));
  return rows.map(({ rooms, ...b }) => ({ ...b, room_name: rooms?.name ?? '' }));
}

async function createBlock(body) {
  const { roomId, startDate, endDate } = body;
  if (!roomId) throw bad('Choose a room.');
  if (!isISODate(startDate) || !isISODate(endDate) || endDate <= startDate) throw bad('The end date must be after the start date.');
  const row = check(
    await supabase.from('blocks').insert({ room_id: Number(roomId), start_date: startDate, end_date: endDate, reason: str(body.reason, 200) }).select('id').single()
  );
  return { id: row.id };
}

// ───────── Rooms ─────────
const isPhoto = (s) => typeof s === 'string' && (s.startsWith('uploads/') || s.startsWith('/uploads/') || s.startsWith(photoUrlPrefix()));
function photoUrlPrefix() {
  return supabase.storage.from('photos').getPublicUrl('').data.publicUrl;
}

function normaliseRoom(b) {
  const name = str(b.name, 80);
  const price = Math.round(Number(b.price));
  const maxGuests = Math.round(Number(b.maxGuests));
  if (name.length < 2) throw bad('Enter a room name.');
  if (!(price > 0)) throw bad('Enter a price per night.');
  if (!(maxGuests >= 1 && maxGuests <= 12)) throw bad('Max guests must be between 1 and 12.');
  const features = Array.isArray(b.features) ? b.features.map((f) => str(f, 40)).filter(Boolean).slice(0, 12) : [];
  const image = str(b.image, 400);
  if (image && !isPhoto(image)) throw bad('Upload the photo from the room form.');
  return {
    name, price, features, image,
    max_guests: maxGuests,
    description: str(b.description, 600),
    active: b.active !== false,
    sort_order: Math.round(Number(b.sortOrder) || 0),
  };
}

async function listRooms() {
  const rows = check(await supabase.from('rooms').select('*, bookings(count)').order('sort_order').order('id'));
  return rows.map((r) => ({ ...roomFromRow(r), bookingCount: r.bookings?.[0]?.count ?? 0 }));
}

async function deleteRoom(id) {
  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error?.code === '23503') throw new ApiError(409, 'This room has bookings, so it can’t be deleted. Hide it from the website instead.');
  check({ error });
  return { ok: true };
}

// ───────── Settings ─────────
const HOTEL_FIELDS = ['name', 'town', 'location', 'addressNote', 'phoneDisplay', 'whatsapp', 'email', 'checkIn', 'checkOut', 'mapsUrl'];
const ICONS = ['wifi', 'dining', 'parking', 'shower', 'events', 'clock', 'bed', 'heart', 'pin', 'phone', 'mail', 'users', 'calendar', 'check'];
const photo = (s) => (isPhoto(s) ? s.slice(0, 400) : '');

async function getSettings() {
  const row = check(await supabase.from('settings').select('value').eq('key', 'site').maybeSingle());
  if (!row) throw new Error('Settings missing: run supabase/schema.sql in Supabase.');
  return row.value;
}

async function saveSettings(b) {
  const cur = await getSettings();
  const hotel = { ...cur.hotel };
  for (const k of HOTEL_FIELDS) if (b.hotel && k in b.hotel) hotel[k] = str(b.hotel[k], 300);
  hotel.whatsapp = hotel.whatsapp.replace(/[^\d]/g, '');
  if (!/^\d{9,15}$/.test(hotel.whatsapp)) throw bad('WhatsApp number must be in international format, like 254700262745.');
  if (hotel.mapsUrl && !/^https:\/\//.test(hotel.mapsUrl)) throw bad('The map link must start with https://');
  if (hotel.name.length < 2) throw bad('Enter the hotel name.');

  const amenities = Array.isArray(b.amenities)
    ? b.amenities.slice(0, 24).map((a) => ({ icon: ICONS.includes(a.icon) ? a.icon : 'check', title: str(a.title, 60), text: str(a.text, 160) })).filter((a) => a.title)
    : cur.amenities;
  const paymentMethods = Array.isArray(b.paymentMethods) ? b.paymentMethods.map((p) => str(p, 60)).filter(Boolean).slice(0, 10) : cur.paymentMethods;
  if (!paymentMethods.length) throw bad('Add at least one payment method.');
  const cs = b.comingSoon || cur.comingSoon || {};
  const comingSoon = { enabled: !!cs.enabled, price: Math.max(0, Math.round(Number(cs.price) || 0)), title: str(cs.title, 80), text: str(cs.text, 300) };
  const gallery = Array.isArray(b.gallery)
    ? b.gallery.slice(0, 24).map((g) => ({ src: photo(g.src), alt: str(g.alt, 160) })).filter((g) => g.src)
    : cur.gallery;
  const images = { hero: photo(b.images?.hero) || cur.images.hero, about: photo(b.images?.about) || cur.images.about };
  const next = { hotel, amenities, paymentMethods, comingSoon, gallery, images };
  check(await supabase.from('settings').upsert({ key: 'site', value: next }));
  return next;
}

// ───────── Uploads ─────────
const MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

export async function uploadPhoto(file) {
  await requireAdmin();
  if (!file) throw bad('Choose an image to upload.');
  if (!MIME[file.type]) throw bad('Upload a JPG, PNG or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw bad('Images must be 5 MB or smaller.');
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
  const name = hex + MIME[file.type];
  check(await supabase.storage.from('photos').upload(name, file, { contentType: file.type, cacheControl: '2592000' }));
  return supabase.storage.from('photos').getPublicUrl(name).data.publicUrl;
}

// ───────── Router ─────────
export async function supabaseAdminApi(path, { method = 'GET', body } = {}) {
  const [route, qs] = path.split('?');
  const params = new URLSearchParams(qs || '');
  const b = body || {};
  const seg = route.split('/').filter(Boolean); // e.g. ['bookings', '12']
  const id = seg[1] !== undefined ? Number(seg[1]) : null;
  const key = `${method} /${seg[0] || ''}${seg.length > 1 ? '/:id' : ''}`;

  if (key === 'POST /login') return login(b);
  if (key === 'POST /logout') {
    await supabase.auth.signOut();
    return { ok: true };
  }
  const user = await requireAdmin();

  switch (key) {
    case 'GET /me': return { username: user.email };
    case 'POST /password': return changePassword(b);
    case 'GET /dashboard': return dashboard();
    case 'GET /bookings': return listBookings(params);
    case 'GET /bookings/:id': {
      const booking = bookingFromRow(await getRawBooking(id));
      const conflicts = check(await supabase.rpc('conflict_message', { p_room: booking.roomId, p_in: booking.checkIn, p_out: booking.checkOut, p_exclude: booking.id }));
      return { ...booking, conflicts: conflicts || null };
    }
    case 'POST /bookings': return createBooking(b);
    case 'PATCH /bookings/:id': return updateBooking(id, b);
    case 'GET /calendar': return calendar(params);
    case 'GET /blocks': return listBlocks();
    case 'POST /blocks': return createBlock(b);
    case 'DELETE /blocks/:id':
      check(await supabase.from('blocks').delete().eq('id', id));
      return { ok: true };
    case 'GET /rooms': return listRooms();
    case 'POST /rooms': return roomFromRow(check(await supabase.from('rooms').insert(normaliseRoom(b)).select('*').single()));
    case 'PUT /rooms/:id': {
      const row = check(await supabase.from('rooms').update(normaliseRoom(b)).eq('id', id).select('*').maybeSingle());
      if (!row) throw new ApiError(404, 'Room not found.');
      return roomFromRow(row);
    }
    case 'DELETE /rooms/:id': return deleteRoom(id);
    case 'GET /settings': return getSettings();
    case 'PUT /settings': return saveSettings(b);
    default:
      throw new ApiError(404, 'Not found.');
  }
}
