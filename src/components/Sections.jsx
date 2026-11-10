import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../site/SiteContext.jsx';
import { kes } from '../lib/format.js';
import Icon, { WhatsAppIcon } from './Icon.jsx';
import RoomPhoto from './RoomPhoto.jsx';

/** Short banner at the top of every inner page. */
export function PageHeader({ eyebrow, title, sub }) {
  const { IMAGES } = useSite();
  return (
    <section className="page-hero" aria-labelledby="page-title">
      <div className="page-hero-bg" aria-hidden="true" style={{ backgroundImage: `url(${IMAGES.hero})` }} />
      <div className="wrap page-hero-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 id="page-title">{title}</h1>
        {sub && <p className="page-hero-sub">{sub}</p>}
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, sub, id }) {
  return (
    <div className="section-head">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      {sub && <p className="sub">{sub}</p>}
    </div>
  );
}

export function Highlights() {
  const items = [
    { icon: 'bed', title: 'Comfortable rooms', text: 'Clean, quiet rooms with quality bedding, reading lights and bedside sockets.' },
    { icon: 'heart', title: 'Personal service', text: 'Our team is on hand to help with your reservation and any questions before you arrive.' },
    { icon: 'pin', title: 'In Sotik, Bomet', text: 'A convenient base for business, family visits and trips through the tea country.' },
  ];
  return (
    <section className="section highlights" aria-label="Why stay with us">
      <div className="wrap feature-grid">
        {items.map((i) => (
          <article className="feature" key={i.title}>
            <span className="feature-icon">
              <Icon name={i.icon} size={24} />
            </span>
            <h3>{i.title}</h3>
            <p>{i.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Compact room cards for the home page; booking happens on /rooms. */
export function RoomsPreview() {
  const { ROOMS } = useSite();
  const from = ROOMS.length ? Math.min(...ROOMS.map((r) => r.price)) : 0;
  return (
    <section className="section alt-bg" aria-labelledby="preview-title">
      <div className="wrap">
        <SectionHead
          id="preview-title"
          eyebrow="Accommodation"
          title="Our rooms"
          sub={from ? `Double rooms from ${kes(from)} per night.` : undefined}
        />
        <div className="preview-grid">
          {ROOMS.slice(0, 3).map((r) => (
            <Link to="/rooms" className="preview-card" key={r.id}>
              <RoomPhoto room={r} alt={`${r.name} with a double bed`} compact />
              <div>
                <h3>{r.name}</h3>
                <span>
                  {kes(r.price)} <small>/ night</small>
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div className="center-cta">
          <Link className="btn btn-primary" to="/rooms">
            See all rooms &amp; book <Icon name="arrow" size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Contact strip at the bottom of the home page. */
export function CtaBand() {
  const { HOTEL } = useSite();
  return (
    <section className="cta-band" aria-label="Contact the hotel">
      <div className="wrap cta-band-row">
        <div>
          <h2>Questions before you book?</h2>
          <p>Call or WhatsApp the front desk. We reply quickly.</p>
        </div>
        <div className="cta-band-actions">
          <a className="btn btn-whatsapp" href={`https://wa.me/${HOTEL.whatsapp}`} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon /> WhatsApp us
          </a>
          <a className="btn btn-ghost" href={`tel:${HOTEL.phoneTel}`}>
            Call {HOTEL.phoneDisplay}
          </a>
        </div>
      </div>
    </section>
  );
}

export function Amenities() {
  const { AMENITIES } = useSite();
  return (
    <section className="section" aria-label="Facilities">
      <div className="wrap">
        <div className="amen-grid">
          {AMENITIES.map((a) => (
            <div className="amen" key={a.title}>
              <span className="amen-icon">
                <Icon name={a.icon} size={22} />
              </span>
              <div>
                <h3>{a.title}</h3>
                <p>{a.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Gallery() {
  const { GALLERY } = useSite();
  const [index, setIndex] = useState(null);
  const count = GALLERY.length;
  const close = useCallback(() => setIndex(null), []);
  const step = useCallback((d) => setIndex((i) => (i + d + count) % count), [count]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [index, close, step]);

  return (
    <section className="section" aria-label="Photo gallery">
      <div className="wrap">
        <div className="gallery-grid">
          {GALLERY.map((g, i) => (
            <button type="button" key={i} className={`gal-item gal-${i % 4}`} onClick={() => setIndex(i)} aria-label={`Enlarge photo: ${g.alt}`}>
              <img src={g.src} alt={g.alt} loading="lazy" />
            </button>
          ))}
        </div>
      </div>

      {index !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={close}>
          <button type="button" className="icon-btn lb-close" onClick={close} aria-label="Close photo viewer" autoFocus>
            <Icon name="close" />
          </button>
          <button type="button" className="icon-btn lb-prev" onClick={(e) => (e.stopPropagation(), step(-1))} aria-label="Previous photo">
            <Icon name="left" />
          </button>
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={GALLERY[index].src} alt={GALLERY[index].alt} />
            <figcaption>
              {GALLERY[index].alt} · {index + 1} / {count}
            </figcaption>
          </figure>
          <button type="button" className="icon-btn lb-next" onClick={(e) => (e.stopPropagation(), step(1))} aria-label="Next photo">
            <Icon name="right" />
          </button>
        </div>
      )}
    </section>
  );
}

export function About() {
  const { HOTEL, IMAGES } = useSite();
  return (
    <section className="section" aria-labelledby="about-title">
      <div className="wrap about-grid">
        <div className="about-image">
          <img src={IMAGES.lounge} alt="Guest sitting area with a wall-mounted TV and an armchair" loading="lazy" />
        </div>
        <div>
          <p className="eyebrow">Our story</p>
          <h2 id="about-title">Hospitality in the heart of Sotik</h2>
          <p>
            {HOTEL.name} welcomes guests looking for a comfortable, good-value place to stay in Sotik, Bomet County.
            Whether you're here on business, visiting family or passing through the tea country, we'll make you feel at
            home.
          </p>
          <p>
            Expect freshly made beds, hot showers, a restaurant serving meals throughout the day and a team that's happy
            to help. Ask us about meeting and event space, too.
          </p>
          <dl className="facts">
            <div>
              <dt>Check-in</dt>
              <dd>From {HOTEL.checkIn}</dd>
            </div>
            <div>
              <dt>Check-out</dt>
              <dd>By {HOTEL.checkOut}</dd>
            </div>
            <div>
              <dt>Reception</dt>
              <dd>24 hours</dd>
            </div>
          </dl>
          <div className="hero-ctas about-ctas">
            <Link className="btn btn-primary" to="/rooms">
              View rooms
            </Link>
            <Link className="text-link" to="/amenities">
              See facilities <Icon name="arrow" size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Contact() {
  const { HOTEL } = useSite();
  const wa = `https://wa.me/${HOTEL.whatsapp}?text=${encodeURIComponent(`Hello ${HOTEL.name} ${HOTEL.town}, I have a question.`)}`;
  return (
    <section className="section" aria-label="Contact details">
      <div className="wrap">
        <div className="contact-grid">
          <div className="info-card">
            <span className="feature-icon">
              <Icon name="pin" size={22} />
            </span>
            <h3>Visit us</h3>
            <p>
              {HOTEL.name}
              <br />
              {HOTEL.location}
            </p>
            <p className="muted small">{HOTEL.addressNote}</p>
            <a className="text-link" href={HOTEL.mapsUrl} target="_blank" rel="noopener noreferrer">
              Get directions <Icon name="arrow" size={16} />
            </a>
          </div>
          <div className="info-card">
            <span className="feature-icon">
              <Icon name="phone" size={22} />
            </span>
            <h3>Reservations</h3>
            <p>
              Phone / WhatsApp
              <br />
              <a className="text-link" href={`tel:${HOTEL.phoneTel}`}>
                {HOTEL.phoneDisplay}
              </a>
            </p>
            <a className="btn btn-whatsapp" href={wa} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon /> Chat on WhatsApp
            </a>
          </div>
          <div className="info-card">
            <span className="feature-icon">
              <Icon name="mail" size={22} />
            </span>
            <h3>Email</h3>
            <p>
              <a className="text-link break" href={`mailto:${HOTEL.email}`}>
                {HOTEL.email}
              </a>
            </p>
            <p className="muted small">
              Check-in from {HOTEL.checkIn} · Check-out by {HOTEL.checkOut}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const { HOTEL } = useSite();
  return (
    <footer className="site-footer">
      <div className="wrap footer-row">
        <div>
          <strong>
            {HOTEL.name} {HOTEL.town}
          </strong>
          <br />
          {HOTEL.location}
        </div>
        <nav aria-label="Footer">
          <Link to="/rooms">Rooms</Link>
          <Link to="/amenities">Amenities</Link>
          <Link to="/gallery">Gallery</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
        </nav>
        <div className="footer-copy">
          © {new Date().getFullYear()} {HOTEL.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export function WhatsAppFab() {
  const { HOTEL } = useSite();
  return (
    <a className="wa-fab" href={`https://wa.me/${HOTEL.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="Chat with the hotel on WhatsApp">
      <WhatsAppIcon size={28} />
    </a>
  );
}
