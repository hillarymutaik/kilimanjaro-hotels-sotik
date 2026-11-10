import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api, useSite } from '../site/SiteContext.jsx';
import { addDays, kes, todayISO } from '../lib/format.js';
import LogoMark from '../components/LogoMark.jsx';
import RoomPhoto from '../components/RoomPhoto.jsx';
import Icon, { WhatsAppIcon } from '../components/Icon.jsx';

/*
 * Looping slideshow for TVs and tablets around the hotel (/screens).
 * Live data: availability every minute, a full reload every 30 minutes so
 * admin changes (rooms, prices, photos, facilities) appear on their own.
 * Optional ?seconds=12 changes how long each slide shows.
 * Keys: ← → to move, Space to pause.
 */
const SECONDS = Math.min(60, Math.max(4, Number(new URLSearchParams(location.search).get('seconds')) || 10));
const REFRESH_MS = 60 * 1000;
const RELOAD_MS = 30 * 60 * 1000;
const clock = (d) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
const longDate = (d) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);

function useQr(text) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#163a31', light: '#ffffff' } })
      .then(setSvg)
      .catch(() => setSvg(''));
  }, [text]);
  return svg;
}

export default function ScreensPage() {
  const site = useSite();
  const { HOTEL, ROOMS, AMENITIES, GALLERY, PAYMENT_METHODS, COMING_SOON, IMAGES } = site;
  const [index, setIndex] = useState(0);
  const [loop, setLoop] = useState(0);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [taken, setTaken] = useState(null);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef(null);

  const bookUrl = `${location.origin}${import.meta.env.BASE_URL}rooms`;
  const shortUrl = bookUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const qr = useQr(bookUrl);

  const refresh = useCallback(async () => {
    const t = todayISO();
    try {
      const d = await api(`/availability?checkIn=${t}&checkOut=${addDays(t, 1)}`);
      setTaken(d.unavailable || []);
    } catch {
      /* keep the last known state */
    }
  }, []);

  useEffect(() => {
    document.title = `${HOTEL.name} ${HOTEL.town} · Screens`;
    refresh();
    const a = setInterval(refresh, REFRESH_MS);
    const c = setInterval(() => setNow(new Date()), 15 * 1000);
    const r = setTimeout(() => location.reload(), RELOAD_MS);
    return () => {
      clearInterval(a);
      clearInterval(c);
      clearTimeout(r);
    };
  }, [refresh, HOTEL]);

  const free = useMemo(
    () => (taken ? ROOMS.filter((r) => !taken.includes(r.id)).sort((a, b) => a.price - b.price) : []),
    [ROOMS, taken]
  );
  const from = ROOMS.length ? Math.min(...ROOMS.map((r) => r.price)) : 0;
  const photo = GALLERY.length ? GALLERY[loop % GALLERY.length] : null;

  const slides = useMemo(
    () =>
      [
        'welcome',
        'tonight',
        'rooms',
        'book',
        AMENITIES.length ? 'facilities' : null,
        'info',
        photo ? 'photo' : null,
        COMING_SOON ? 'soon' : null,
      ].filter(Boolean),
    [AMENITIES.length, photo, COMING_SOON]
  );

  const go = useCallback((step) => setIndex((i) => (i + step + slides.length) % slides.length), [slides.length]);
  // Each time the show starts over, the photo slide moves on to the next gallery photo.
  useEffect(() => {
    if (index === 0) setLoop((l) => l + 1);
  }, [index]);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => go(1), SECONDS * 1000);
    return () => clearTimeout(t);
  }, [index, paused, go]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === 'f') document.documentElement.requestFullscreen?.().catch(() => {});
    };
    const wake = () => {
      setIdle(false);
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setIdle(true), 3000);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousemove', wake);
    wake();
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousemove', wake);
      clearTimeout(idleTimer.current);
    };
  }, [go]);

  const current = slides[Math.min(index, slides.length - 1)];
  const S = (id, children, extra = '') => (
    <section key={id} className={`scr-slide scr-${id}${current === id ? ' is-active' : ''} ${extra}`} aria-hidden={current !== id}>
      {children}
    </section>
  );

  return (
    <div className={`scr${idle ? ' is-idle' : ''}`}>
      {/* 1. Welcome */}
      {S(
        'welcome',
        <>
          {IMAGES.hero && <img className="scr-bg" src={IMAGES.hero} alt="" />}
          <div className="scr-welcome-text">
            <p className="scr-eyebrow">Karibu · Welcome</p>
            <h1>
              Welcome to {HOTEL.name}, {HOTEL.town}
            </h1>
            <p className="scr-lead">Comfortable rooms, hot meals and friendly service, any time of day.</p>
          </div>
        </>
      )}

      {/* 2. Available tonight (live) */}
      {S(
        'tonight',
        <div className="scr-pad scr-tonight-grid">
          <div>
            <p className="scr-eyebrow">Tonight · {longDate(now)}</p>
            {taken == null ? (
              <h2>Checking rooms…</h2>
            ) : free.length ? (
              <>
                <p className="scr-big">{free.length}</p>
                <h2>{free.length === 1 ? 'room available tonight' : 'rooms available tonight'}</h2>
                <p className="scr-lead">From {kes(free[0].price)} per night. Walk in and ask at reception.</p>
              </>
            ) : (
              <>
                <h2>We’re fully booked tonight</h2>
                <p className="scr-lead">Ask at reception about tomorrow, or book ahead online.</p>
              </>
            )}
          </div>
          <ul className="scr-free">
            {free.slice(0, 6).map((r) => (
              <li key={r.id}>
                <span className="scr-dot" aria-hidden="true" />
                <strong>{r.name}</strong>
                <span>{kes(r.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Rooms and prices */}
      {S(
        'rooms',
        <div className="scr-pad">
          <p className="scr-eyebrow">Our rooms</p>
          <h2>Rooms from {kes(from)} a night</h2>
          <ul className="scr-rooms">
            {[...ROOMS]
              .sort((a, b) => a.price - b.price)
              .slice(0, 6)
              .map((r) => (
                <li key={r.id}>
                  <div className="scr-room-pic">
                    <RoomPhoto room={r} lazy={false} />
                  </div>
                  <div className="scr-room-body">
                    <strong>{r.name}</strong>
                    <span>
                      {kes(r.price)} <small>/ night · up to {r.maxGuests}</small>
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* 4. How to book */}
      {S(
        'book',
        <div className="scr-pad scr-book-grid">
          <div>
            <p className="scr-eyebrow">Book your next stay</p>
            <h2>Scan to check dates and book</h2>
            <ol className="scr-steps">
              <li>
                <b>1</b> Scan the code with your phone camera
              </li>
              <li>
                <b>2</b> Pick your dates and room
              </li>
              <li>
                <b>3</b> Send your request, we confirm quickly
              </li>
            </ol>
            <div className="scr-contacts">
              <span>
                <WhatsAppIcon /> WhatsApp {HOTEL.phoneDisplay}
              </span>
              <span>
                <Icon name="phone" size={22} /> Call {HOTEL.phoneDisplay}
              </span>
            </div>
          </div>
          <figure className="scr-qr">
            {qr ? <div className="scr-qr-code" dangerouslySetInnerHTML={{ __html: qr }} /> : <div className="scr-qr-code" />}
            <figcaption>{shortUrl}</figcaption>
          </figure>
        </div>
      )}

      {/* 5. Facilities */}
      {AMENITIES.length > 0 &&
        S(
          'facilities',
          <div className="scr-pad">
            <p className="scr-eyebrow">Every stay includes</p>
            <h2>Facilities</h2>
            <ul className="scr-amen">
              {AMENITIES.slice(0, 6).map((a) => (
                <li key={a.title}>
                  <span className="scr-amen-icon">
                    <Icon name={a.icon} size={34} />
                  </span>
                  <strong>{a.title}</strong>
                  <span>{a.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* 6. Good to know */}
      {S(
        'info',
        <div className="scr-pad">
          <p className="scr-eyebrow">Good to know</p>
          <h2>Your stay at a glance</h2>
          <div className="scr-facts">
            <div>
              <span>Check-in from</span>
              <strong>{HOTEL.checkIn}</strong>
            </div>
            <div>
              <span>Check-out by</span>
              <strong>{HOTEL.checkOut}</strong>
            </div>
            <div>
              <span>Reception</span>
              <strong>24 hours</strong>
            </div>
          </div>
          <p className="scr-label">Ways to pay</p>
          <ul className="scr-pills">
            {PAYMENT_METHODS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 7. Photo spotlight, a different photo on each loop */}
      {photo &&
        S(
          'photo',
          <>
            <img className="scr-bg scr-kenburns" key={photo.src} src={photo.src} alt="" />
            <div className="scr-photo-cap">
              <p className="scr-eyebrow">A look inside</p>
              <h2>{photo.alt?.split(':')[0] || HOTEL.name}</h2>
            </div>
          </>
        )}

      {/* 8. Coming soon (only while enabled in Settings) */}
      {COMING_SOON &&
        S(
          'soon',
          <div className="scr-pad scr-soon">
            <p className="scr-eyebrow">Coming soon</p>
            <h2>{COMING_SOON.title}</h2>
            <p className="scr-lead">{COMING_SOON.text}</p>
            {COMING_SOON.price > 0 && <p className="scr-big scr-soon-price">{kes(COMING_SOON.price)}</p>}
          </div>
        )}

      {/* Always on top: brand, clock, progress */}
      <header className="scr-chrome">
        <div className="scr-brand">
          <LogoMark />
          <span>
            {HOTEL.name}
            <small>{HOTEL.town} · Kenya</small>
          </span>
        </div>
        <div className="scr-clock">{clock(now)}</div>
      </header>
      <footer className="scr-progress" aria-hidden="true">
        {slides.map((id, i) => (
          <span key={id} className={i < index ? 'is-done' : i === index ? 'is-now' : ''}>
            {i === index && <i key={`${index}-${loop}`} style={{ animationDuration: `${SECONDS}s`, animationPlayState: paused ? 'paused' : 'running' }} />}
          </span>
        ))}
      </footer>
      {paused && <div className="scr-paused">Paused · press Space to resume</div>}
      <button type="button" className="scr-full" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
        Full screen
      </button>
    </div>
  );
}
