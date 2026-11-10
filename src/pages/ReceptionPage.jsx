import { useCallback, useEffect, useState } from 'react';
import { api, useSite } from '../site/SiteContext.jsx';
import { addDays, kes, todayISO } from '../lib/format.js';
import LogoMark from '../components/LogoMark.jsx';
import RoomPhoto from '../components/RoomPhoto.jsx';
import Icon from '../components/Icon.jsx';

const REFRESH_MS = 60 * 1000; // availability
const RELOAD_MS = 30 * 60 * 1000; // full reload, to pick up new rooms, prices and photos

const clock = (d) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
const longDate = (d) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);

/**
 * Full-screen "Rooms available tonight" board for a TV or tablet at the front desk.
 * Uses the public availability check, so it never shows guest names. Refreshes itself.
 */
export default function ReceptionPage() {
  const { HOTEL, ROOMS } = useSite();
  const [now, setNow] = useState(() => new Date());
  const [taken, setTaken] = useState(null); // room ids taken tonight; null = loading
  const [updated, setUpdated] = useState(null);
  const [offline, setOffline] = useState(false);
  const [full, setFull] = useState(false);

  const refresh = useCallback(async () => {
    const tonight = todayISO();
    try {
      const d = await api(`/availability?checkIn=${tonight}&checkOut=${addDays(tonight, 1)}`);
      setTaken(d.unavailable || []);
      setUpdated(new Date());
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    document.title = `Rooms available tonight | ${HOTEL.name} ${HOTEL.town}`;
    refresh();
    const a = setInterval(refresh, REFRESH_MS);
    const c = setInterval(() => setNow(new Date()), 15 * 1000);
    const r = setTimeout(() => location.reload(), RELOAD_MS);
    const onFull = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFull);
    return () => {
      clearInterval(a);
      clearInterval(c);
      clearTimeout(r);
      document.removeEventListener('fullscreenchange', onFull);
    };
  }, [refresh, HOTEL]);

  // At midnight "tonight" moves on, so check again when the date changes.
  const today = todayISO();
  useEffect(() => {
    refresh();
  }, [today, refresh]);

  const rooms = ROOMS.map((r) => ({ ...r, free: taken ? !taken.includes(r.id) : null })).sort(
    (a, b) => Number(b.free) - Number(a.free) || a.price - b.price
  );
  const freeCount = rooms.filter((r) => r.free).length;
  const cheapest = rooms.filter((r) => r.free).reduce((m, r) => (m == null || r.price < m ? r.price : m), null);

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="rcp">
      <header className="rcp-top">
        <div className="rcp-brand">
          <LogoMark />
          <div>
            <strong>{HOTEL.name}</strong>
            <span>{HOTEL.town} · Kenya</span>
          </div>
        </div>
        <div className="rcp-time">
          <strong>{clock(now)}</strong>
          <span>{longDate(now)}</span>
        </div>
      </header>

      <section className="rcp-hero" aria-live="polite">
        <p className="rcp-eyebrow">Welcome · Karibu</p>
        <h1>
          {taken == null
            ? 'Checking rooms for tonight…'
            : freeCount === 0
              ? 'We’re full tonight'
              : `${freeCount} ${freeCount === 1 ? 'room' : 'rooms'} available tonight`}
        </h1>
        <p className="rcp-sub">
          {taken == null
            ? ' '
            : freeCount === 0
              ? 'Ask at the desk about tomorrow, or about our next free room.'
              : `From ${kes(cheapest)} per night. Ask at the desk to book, and we’ll show you the room.`}
        </p>
      </section>

      <ul className="rcp-grid">
        {rooms.map((r) => (
          <li key={r.id} className={`rcp-card${r.free === false ? ' is-taken' : ''}`}>
            <div className="rcp-pic">
              <RoomPhoto room={r} lazy={false} />
              {r.free != null && (
                <span className={`rcp-status ${r.free ? 'is-free' : 'is-full'}`}>
                  <Icon name={r.free ? 'check' : 'close'} size={16} /> {r.free ? 'Available tonight' : 'Taken tonight'}
                </span>
              )}
            </div>
            <div className="rcp-body">
              <h2>{r.name}</h2>
              <p className="rcp-price">
                {kes(r.price)} <small>per night</small>
              </p>
              <p className="rcp-meta">
                <Icon name="users" size={16} /> Up to {r.maxGuests} {r.maxGuests === 1 ? 'guest' : 'guests'}
                {r.features?.[0] && (
                  <>
                    {' '}
                    · {r.features.slice(0, 2).join(' · ')}
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <footer className="rcp-foot">
        <span>
          <Icon name="clock" size={16} /> Check-in from {HOTEL.checkIn} · Check-out by {HOTEL.checkOut}
        </span>
        <span>
          <Icon name="phone" size={16} /> {HOTEL.phoneDisplay}
        </span>
        <span className="rcp-updated">
          {offline ? 'Can’t reach the booking system, retrying…' : updated ? `Updated ${clock(updated)}` : ''}
        </span>
        {!full && document.documentElement.requestFullscreen && (
          <button type="button" className="rcp-full" onClick={toggleFull}>
            Full screen
          </button>
        )}
      </footer>
    </div>
  );
}
