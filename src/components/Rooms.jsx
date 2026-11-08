import { useSite } from '../site/SiteContext.jsx';
import { formatDate, kes, plural } from '../lib/format.js';
import Icon, { WhatsAppIcon } from './Icon.jsx';

export default function Rooms({ stay, nights, searched, unavailable = [], onBook }) {
  const { HOTEL, IMAGES, ROOMS, AMENITIES, GALLERY, PAYMENT_METHODS, COMING_SOON } = useSite();
  const fitting = ROOMS.filter((r) => r.maxGuests >= stay.guests);

  const summary =
    searched && nights > 0
      ? `${plural(nights, 'night')}, ${formatDate(stay.checkIn)} to ${formatDate(stay.checkOut)}, for ${plural(
          stay.guests,
          'guest'
        )}.`
      : 'Pick your dates above to see the total price for your stay.';

  const groupMsg = encodeURIComponent(
    `Hello ${HOTEL.name} ${HOTEL.town}, I'd like to book for ${stay.guests} guests from ${stay.checkIn} to ${stay.checkOut}. Which rooms are available?`
  );

  return (
    <section className="section" id="rooms" aria-labelledby="rooms-title">
      <div className="wrap">
        <div className="section-head">
          <p className="eyebrow">Accommodation</p>
          <h2 id="rooms-title">Our rooms</h2>
          <p className="sub" aria-live="polite">
            {summary}
          </p>
        </div>

        {fitting.length === 0 ? (
          <div className="none">
            <p>
              Our rooms sleep up to 2 guests each. Message us to book two rooms for your group of {stay.guests}, and
              we'll sort out the best arrangement.
            </p>
            <a
              className="btn btn-whatsapp"
              href={`https://wa.me/${HOTEL.whatsapp}?text=${groupMsg}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon /> Ask on WhatsApp
            </a>
          </div>
        ) : (
          <div className="room-grid">
            {fitting.map((r) => {
              const taken = searched && unavailable.includes(r.id);
              return (
              <article className={`room-card${taken ? ' is-taken' : ''}`} key={r.id}>
                <div className="room-pic">
                  <img src={r.image} alt={`${r.name} with a double bed`} loading="lazy" />
                  <span className="room-badge">
                    <Icon name="users" size={14} /> Up to {r.maxGuests}
                  </span>
                </div>
                <div className="room-body">
                  <h3>{r.name}</h3>
                  <p className="room-desc">{r.description}</p>
                  <ul className="tags">
                    {r.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <div className="room-foot">
                    <div className="price">
                      {kes(r.price)} <small>per night</small>
                      {searched && nights > 0 && (
                        <span className="price-total">
                          {kes(r.price * nights)} for {plural(nights, 'night')}
                        </span>
                      )}
                    </div>
                    {taken ? (
                      <span className="taken-label">Booked for these dates</span>
                    ) : (
                      <button type="button" className="btn btn-primary" onClick={() => onBook(r)}>
                        Book this room
                      </button>
                    )}
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        )}

        {COMING_SOON && (
          <aside className="coming-soon" aria-label={COMING_SOON.title}>
            <div>
              <p className="eyebrow">Coming soon</p>
              <h3>{COMING_SOON.title}</h3>
              <p>{COMING_SOON.text}</p>
            </div>
            <div className="coming-soon-cta">
              <div className="price">
                {kes(COMING_SOON.price)} <small>per night</small>
              </div>
              <a
                className="btn btn-whatsapp"
                href={`https://wa.me/${HOTEL.whatsapp}?text=${encodeURIComponent(
                  `Hello ${HOTEL.name} ${HOTEL.town}, please let me know when the ${kes(COMING_SOON.price)} rooms open.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon /> Notify me
              </a>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
