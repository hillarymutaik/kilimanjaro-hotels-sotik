import { useEffect, useRef, useState } from 'react';
import { api, useSite } from '../site/SiteContext.jsx';
import { addDays, formatDate, isKenyanPhone, kes, nightsBetween, plural, todayISO } from '../lib/format.js';
import Icon, { WhatsAppIcon } from './Icon.jsx';

export default function BookingModal({ room, stay, onStayChange, onClose, onBooked }) {
  const { HOTEL, PAYMENT_METHODS } = useSite();
  const [form, setForm] = useState({ name: '', phone: '', email: '', requests: '', payment: PAYMENT_METHODS[0] });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [request, setRequest] = useState(null); // set once the guest submits details
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);

  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const total = nights > 0 ? room.price * nights : 0;

  // Lock page scroll, focus the first field, close on Escape, restore focus after.
  useEffect(() => {
    const prevFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstFieldRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll(
          'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [onClose]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const setCheckIn = (v) => {
    const next = { ...stay, checkIn: v };
    if (v && (!stay.checkOut || stay.checkOut <= v)) next.checkOut = addDays(v, 1);
    onStayChange(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    if (nights < 1) return setError('Check-out must be after check-in.');
    if (stay.checkIn < todayISO()) return setError('Check-in cannot be in the past.');
    if (stay.guests > room.maxGuests) return setError(`The ${room.name} sleeps up to ${room.maxGuests} guests.`);
    if (form.name.trim().length < 2) return setError('Enter your full name.');
    if (!isKenyanPhone(form.phone)) return setError('Enter a valid Kenyan phone number, like 0712 345 678.');
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return setError('Check your email address, or leave it blank.');
    setError('');
    setSending(true);
    try {
      // The server checks availability, computes the price and issues the reference.
      const saved = await api('/bookings', { roomId: room.id, ...stay, ...form });
      setRequest({ ...form, ...saved });
      onBooked?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const message = request
    ? [
        `BOOKING REQUEST: ${HOTEL.name.toUpperCase()} ${HOTEL.town.toUpperCase()}`,
        `Reference: ${request.ref}`,
        `Room: ${room.name}`,
        `Check-in: ${formatDate(request.checkIn)}`,
        `Check-out: ${formatDate(request.checkOut)}`,
        `Nights: ${request.nights}`,
        `Guests: ${request.guests}`,
        `Estimated total: ${kes(request.total)}`,
        `Name: ${request.name.trim()}`,
        `Phone: ${request.phone.trim()}`,
        request.email ? `Email: ${request.email.trim()}` : null,
        `Payment: ${request.payment}`,
        `Special requests: ${request.requests.trim() || 'None'}`,
        '',
        'Please confirm availability and the final price.',
      ]
        .filter((l) => l !== null)
        .join('\n')
    : '';
  const waHref = `https://wa.me/${HOTEL.whatsapp}?text=${encodeURIComponent(message)}`;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bk-title" ref={dialogRef}>
        <div className="modal-media">
          <img src={room.image} alt="" />
          <div className="modal-media-cap">
            <h2 id="bk-title">{request ? 'Booking request sent' : `Book the ${room.name}`}</h2>
            <span>{kes(room.price)} per night</span>
          </div>
          <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close booking">
            <Icon name="close" />
          </button>
        </div>

        <ol className="steps" aria-label="Booking progress">
          <li className="done">Room</li>
          <li className={request ? 'done' : 'current'} aria-current={request ? undefined : 'step'}>
            Your details
          </li>
          <li className={request ? 'current' : ''} aria-current={request ? 'step' : undefined}>
            Request sent
          </li>
        </ol>

        {!request ? (
          <form className="modal-body" onSubmit={submit} noValidate>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="bk-ci">Check-in</label>
                <input
                  ref={firstFieldRef}
                  id="bk-ci"
                  type="date"
                  min={todayISO()}
                  value={stay.checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="bk-co">Check-out</label>
                <input
                  id="bk-co"
                  type="date"
                  min={stay.checkIn ? addDays(stay.checkIn, 1) : todayISO()}
                  value={stay.checkOut}
                  onChange={(e) => onStayChange({ ...stay, checkOut: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="bk-gu">Guests</label>
                <select id="bk-gu" value={stay.guests} onChange={(e) => onStayChange({ ...stay, guests: +e.target.value })}>
                  {Array.from({ length: room.maxGuests }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {plural(n, 'guest')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="bk-pay">Payment method</label>
                <select id="bk-pay" value={form.payment} onChange={set('payment')}>
                  {PAYMENT_METHODS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="summary" aria-live="polite">
              <div>
                <span>
                  {kes(room.price)} × {nights > 0 ? plural(nights, 'night') : '—'}
                </span>
                <span>{nights > 0 ? kes(total) : '—'}</span>
              </div>
              <div className="muted">
                <span>{nights > 0 ? `${formatDate(stay.checkIn)} → ${formatDate(stay.checkOut)}` : 'Choose valid dates'}</span>
                <span>{plural(stay.guests, 'guest')}</span>
              </div>
              <div className="total">
                <span>Estimated total</span>
                <span>{nights > 0 ? kes(total) : '—'}</span>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="bk-nm">Full name</label>
                <input id="bk-nm" autoComplete="name" value={form.name} onChange={set('name')} />
              </div>
              <div className="field">
                <label htmlFor="bk-ph">Phone number</label>
                <input
                  id="bk-ph"
                  type="tel"
                  autoComplete="tel"
                  placeholder="07XX XXX XXX"
                  value={form.phone}
                  onChange={set('phone')}
                />
              </div>
              <div className="field full">
                <label htmlFor="bk-em">Email (optional)</label>
                <input id="bk-em" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
              </div>
              <div className="field full">
                <label htmlFor="bk-rq">Special requests (optional)</label>
                <textarea
                  id="bk-rq"
                  rows={2}
                  placeholder="Late arrival, extra pillows, dietary needs…"
                  value={form.requests}
                  onChange={set('requests')}
                />
              </div>
            </div>

            <p className="err" role="alert">
              {error}
            </p>
            <button type="submit" className="btn btn-primary btn-block" disabled={sending} aria-busy={sending}>
              {sending ? 'Sending request…' : 'Send booking request'} {!sending && <Icon name="arrow" size={18} />}
            </button>
            <p className="note">
              This is a booking request, not an instant confirmed reservation. The hotel will confirm availability and
              the final price.
            </p>
          </form>
        ) : (
          <div className="modal-body ready" role="status">
            <p>
              Thank you, <strong>{request.name.trim()}</strong>. Your booking reference is:
            </p>
            <div className="ref">{request.ref}</div>
            <div className="summary">
              <div>
                <span>{room.name}</span>
                <span>{plural(request.nights, 'night')}</span>
              </div>
              <div className="muted">
                <span>
                  {formatDate(request.checkIn)} → {formatDate(request.checkOut)}
                </span>
                <span>{plural(request.guests, 'guest')}</span>
              </div>
              <div className="muted">
                <span>Payment</span>
                <span>{request.payment}</span>
              </div>
              <div className="total">
                <span>Estimated total</span>
                <span>{kes(request.total)}</span>
              </div>
            </div>
            <p className="ready-step">
              <Icon name="check" size={18} />
              <span>
                <strong>Request received.</strong> The front desk will contact you on {request.phone.trim()} to confirm
                your room. For a faster reply, send it to us on WhatsApp too.
              </span>
            </p>
            <a className="btn btn-whatsapp btn-block" href={waHref} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon /> Send on WhatsApp
            </a>
            <div className="ready-alt">
              <span>
                Prefer to call? <a href={`tel:${HOTEL.phoneTel}`}>{HOTEL.phoneDisplay}</a>
              </span>
              <button type="button" className="link-btn" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
