// View / edit a booking, change its status, record payments, contact the guest.
// Also used (with id = null) to create a walk-in or phone booking.
import { useEffect, useState } from 'react';
import { WhatsAppIcon } from '../components/Icon.jsx';
import { formatDate, kes, nightsBetween, plural, todayISO, addDays } from '../lib/format.js';
import { get, patch, post, SOURCE_LABEL, STATUS_LABEL } from './api.js';
import { useAdmin } from './context.js';
import { Field, Panel, Spinner, StatusBadge } from './ui.jsx';

const ACTIONS = {
  pending: [['confirmed', 'Confirm booking', 'primary'], ['cancelled', 'Decline / cancel', 'danger']],
  confirmed: [['checked_in', 'Check in guest', 'primary'], ['no_show', 'Mark no-show', 'ghost'], ['cancelled', 'Cancel booking', 'danger']],
  checked_in: [['checked_out', 'Check out guest', 'primary']],
  checked_out: [],
  cancelled: [['pending', 'Reopen as pending', 'ghost']],
  no_show: [['pending', 'Reopen as pending', 'ghost']],
};

function toForm(b) {
  return {
    roomId: b.roomId, checkIn: b.checkIn, checkOut: b.checkOut, guests: b.guests, pricePerNight: b.pricePerNight,
    amountPaid: b.amountPaid, name: b.name, phone: b.phone, email: b.email, payment: b.payment, source: b.source,
    status: b.status, requests: b.requests, notes: b.notes,
  };
}

export default function BookingPanel({ id, initial, onClose, onChanged }) {
  const { notify } = useAdmin();
  const [booking, setBooking] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [payAmount, setPayAmount] = useState('');

  useEffect(() => {
    get('/rooms').then(setRooms).catch((e) => setError(e.message));
    get('/settings').then((s) => setPayments(s.paymentMethods)).catch(() => {});
    if (id) {
      get(`/bookings/${id}`).then((b) => {
        setBooking(b);
        setForm(toForm(b));
      }).catch((e) => setError(e.message));
    } else {
      const t = todayISO();
      setForm({
        roomId: '', checkIn: t, checkOut: addDays(t, 1), guests: 1, pricePerNight: '', amountPaid: 0, name: '', phone: '',
        email: '', payment: '', source: 'walk_in', status: 'confirmed', requests: '', notes: '', ...initial,
      });
    }
    // `initial` only seeds a new booking once; ignore later identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const room = rooms.find((r) => r.id === Number(form?.roomId));
  const nights = form ? nightsBetween(form.checkIn, form.checkOut) : 0;
  const rate = form?.pricePerNight !== '' && form?.pricePerNight != null ? Number(form.pricePerNight) : room?.price || 0;

  const run = async (fn, ok) => {
    setBusy(true);
    setError('');
    try {
      const b = await fn();
      notify(ok);
      onChanged?.();
      if (!id) return onClose();
      const fresh = await get(`/bookings/${b.id}`);
      setBooking(fresh);
      setForm(toForm(fresh));
      setEditing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = (e) => {
    e?.preventDefault();
    const body = { ...form, roomId: Number(form.roomId), guests: Number(form.guests), amountPaid: Number(form.amountPaid) || 0 };
    if (id) {
      // Only send a price override if staff changed it.
      if (Number(form.pricePerNight) === booking.pricePerNight && Number(form.roomId) !== booking.roomId) delete body.pricePerNight;
      return run(() => patch(`/bookings/${id}`, body), 'Booking saved.');
    }
    return run(() => post('/bookings', body), 'Booking created.');
  };
  const setStatus = (status) => run(() => patch(`/bookings/${id}`, { status }), `Marked as ${STATUS_LABEL[status].toLowerCase()}.`);
  const addPayment = (e) => {
    e.preventDefault();
    const amt = Math.round(Number(payAmount));
    if (!(amt > 0)) return setError('Enter the amount received.');
    setPayAmount('');
    run(() => patch(`/bookings/${id}`, { amountPaid: booking.amountPaid + amt }), `Recorded ${kes(amt)} payment.`);
  };

  if (!form) {
    return (
      <Panel title="Booking" onClose={onClose}>
        {error ? <p className="a-err">{error}</p> : <Spinner label="Loading booking" />}
      </Panel>
    );
  }

  const waText = booking
    ? `Hello ${booking.name}, this is Kilimanjaro Hotels Sotik. ${
        booking.status === 'confirmed' || booking.status === 'checked_in'
          ? `Your booking ${booking.ref} is confirmed`
          : `About your booking request ${booking.ref}`
      }: ${booking.roomName}, ${formatDate(booking.checkIn)} to ${formatDate(booking.checkOut)} (${plural(booking.nights, 'night')}), total ${kes(booking.total)}.`
    : '';

  return (
    <Panel
      wide
      title={id ? `Booking ${booking?.ref || ''}` : 'New booking'}
      onClose={onClose}
      footer={
        editing ? (
          <>
            {id && (
              <button type="button" className="a-btn a-btn-ghost" onClick={() => (setEditing(false), setForm(toForm(booking)), setError(''))}>
                Cancel
              </button>
            )}
            <button type="submit" form="booking-form" className="a-btn a-btn-primary" disabled={busy}>
              {busy ? 'Saving…' : id ? 'Save changes' : 'Create booking'}
            </button>
          </>
        ) : null
      }
    >
      {error && <p className="a-err a-err-box" role="alert">{error}</p>}

      {booking && !editing && (
        <>
          <div className="bk-head">
            <StatusBadge status={booking.status} />
            <span className="muted">
              {SOURCE_LABEL[booking.source]} · created {booking.createdAt}
            </span>
          </div>
          {booking.conflicts && <p className="a-warn">⚠ {booking.conflicts}</p>}

          <div className="bk-actions">
            {ACTIONS[booking.status].map(([s, label, kind]) => (
              <button key={s} type="button" className={`a-btn a-btn-${kind}`} disabled={busy} onClick={() => setStatus(s)}>
                {label}
              </button>
            ))}
            <button type="button" className="a-btn a-btn-ghost" onClick={() => setEditing(true)}>
              Edit details
            </button>
          </div>

          <dl className="bk-grid">
            <div><dt>Guest</dt><dd>{booking.name}</dd></div>
            <div>
              <dt>Phone</dt>
              <dd>
                <a href={`tel:${booking.phone.replace(/\s/g, '')}`}>{booking.phone}</a>
              </dd>
            </div>
            {booking.email && <div><dt>Email</dt><dd><a href={`mailto:${booking.email}`}>{booking.email}</a></dd></div>}
            <div><dt>Room</dt><dd>{booking.roomName}</dd></div>
            <div><dt>Stay</dt><dd>{formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}</dd></div>
            <div><dt>Nights · guests</dt><dd>{plural(booking.nights, 'night')} · {plural(booking.guests, 'guest')}</dd></div>
            <div><dt>Rate</dt><dd>{kes(booking.pricePerNight)} / night</dd></div>
            <div><dt>Payment method</dt><dd>{booking.payment || '—'}</dd></div>
          </dl>

          <div className="bk-money">
            <div><span>Total</span><strong>{kes(booking.total)}</strong></div>
            <div><span>Paid</span><strong>{kes(booking.amountPaid)}</strong></div>
            <div className={booking.balance > 0 ? 'owing' : 'settled'}>
              <span>Balance</span><strong>{kes(booking.balance)}</strong>
            </div>
          </div>
          {booking.balance > 0 && !['cancelled', 'no_show'].includes(booking.status) && (
            <form className="bk-pay" onSubmit={addPayment}>
              <input type="number" min="1" inputMode="numeric" placeholder="Amount received (KES)" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} aria-label="Amount received" />
              <button className="a-btn" disabled={busy}>Record payment</button>
              <button type="button" className="a-btn a-btn-ghost" disabled={busy} onClick={() => setPayAmount(String(booking.balance))}>Full balance</button>
            </form>
          )}

          {booking.requests && (
            <div className="bk-note"><strong>Guest requests</strong><p>{booking.requests}</p></div>
          )}
          {booking.notes && (
            <div className="bk-note"><strong>Staff notes</strong><p>{booking.notes}</p></div>
          )}

          <div className="bk-contact">
            <a className="a-btn a-btn-wa" href={`https://wa.me/${booking.whatsapp}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon size={18} /> WhatsApp guest
            </a>
            <a className="a-btn" href={`tel:${booking.phone.replace(/\s/g, '')}`}>Call guest</a>
            <button type="button" className="a-btn a-btn-ghost" onClick={() => window.print()}>Print</button>
          </div>
        </>
      )}

      {editing && (
        <form id="booking-form" className="a-form" onSubmit={save}>
          <Field label="Room">
            <select value={form.roomId} onChange={set('roomId')} required>
              <option value="">Choose a room…</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {kes(r.price)}{r.active ? '' : ' (hidden)'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Guests">
            <input type="number" min="1" max={room?.maxGuests || 12} value={form.guests} onChange={set('guests')} required />
          </Field>
          <Field label="Check-in">
            <input type="date" value={form.checkIn} onChange={set('checkIn')} required />
          </Field>
          <Field label="Check-out">
            <input type="date" value={form.checkOut} min={form.checkIn ? addDays(form.checkIn, 1) : undefined} onChange={set('checkOut')} required />
          </Field>
          <Field label="Price per night (KES)" hint={room ? `Room rate: ${kes(room.price)}. Change it to give a discount.` : ''}>
            <input type="number" min="0" value={form.pricePerNight} placeholder={room ? String(room.price) : ''} onChange={set('pricePerNight')} />
          </Field>
          <Field label="Amount paid (KES)">
            <input type="number" min="0" value={form.amountPaid} onChange={set('amountPaid')} />
          </Field>
          <div className="a-total full">
            {nights > 0 ? `${plural(nights, 'night')} × ${kes(rate)} = ` : 'Choose valid dates · '}
            <strong>{nights > 0 ? kes(rate * nights) : '—'}</strong>
          </div>
          <Field label="Guest name">
            <input value={form.name} onChange={set('name')} required />
          </Field>
          <Field label="Phone">
            <input type="tel" value={form.phone} onChange={set('phone')} placeholder="07XX XXX XXX" required />
          </Field>
          <Field label="Email (optional)">
            <input type="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Payment method">
            <select value={form.payment} onChange={set('payment')}>
              <option value="">—</option>
              {[...new Set([...payments, form.payment].filter(Boolean))].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Booked via">
            <select value={form.source} onChange={set('source')}>
              {Object.entries(SOURCE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={set('status')}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Guest requests" full>
            <textarea rows={2} value={form.requests} onChange={set('requests')} />
          </Field>
          <Field label="Staff notes (not shown to guest)" full>
            <textarea rows={3} value={form.notes} onChange={set('notes')} />
          </Field>
        </form>
      )}
    </Panel>
  );
}
