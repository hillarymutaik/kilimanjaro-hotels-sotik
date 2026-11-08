import { createContext, useContext, useEffect, useState } from 'react';

// Shown only if the API can't be reached, so guests can still contact the hotel.
const FALLBACK_CONTACT = { name: 'Kilimanjaro Hotels', phoneDisplay: '+254 700 262 745', whatsapp: '254700262745' };

// Static build (GitHub Pages): no server, so content comes from site.json,
// every room shows as available and booking requests go to WhatsApp only.
export const STATIC = import.meta.env.VITE_STATIC === '1';

const SiteContext = createContext(null);

function shape(d) {
  return {
    HOTEL: { ...d.hotel, phoneTel: '+' + d.hotel.whatsapp },
    IMAGES: { hero: d.images.hero, lounge: d.images.about },
    ROOMS: d.rooms,
    AMENITIES: d.amenities,
    GALLERY: d.gallery,
    PAYMENT_METHODS: d.paymentMethods,
    COMING_SOON: d.comingSoon,
  };
}

export function SiteProvider({ children }) {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    fetch(STATIC ? import.meta.env.BASE_URL + 'site.json' : '/api/site')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((d) => alive && setState({ status: 'ready', site: shape(d) }))
      .catch(() => alive && setState({ status: 'error' }));
    return () => {
      alive = false;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="boot">
        <div className="boot-spinner" aria-hidden="true" />
        <p>Loading Kilimanjaro Hotels…</p>
      </div>
    );
  }
  if (state.status === 'error') {
    const c = FALLBACK_CONTACT;
    return (
      <div className="boot">
        <h1>{c.name}, Sotik</h1>
        <p>Our booking page is temporarily unavailable. Please contact us directly to book your stay.</p>
        <p>
          <a className="btn btn-primary" href={`tel:+${c.whatsapp}`}>
            Call {c.phoneDisplay}
          </a>{' '}
          <a className="btn btn-whatsapp" href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noopener noreferrer">
            WhatsApp us
          </a>
        </p>
      </div>
    );
  }
  return <SiteContext.Provider value={state.site}>{children}</SiteContext.Provider>;
}

export function useSite() {
  return useContext(SiteContext);
}

/** Small JSON fetch helper for the public API. Throws Error(message) on failure. */
export async function api(path, body) {
  if (STATIC) return staticApi(path, body);
  const r = await fetch('/api' + path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong. Please try again, or call the hotel.');
  return data;
}

let staticRooms = null;

/** Stand-in for the API in the static build. Nothing is saved anywhere. */
async function staticApi(path, body) {
  if (path.startsWith('/availability')) return { unavailable: [] };
  if (path === '/bookings' && body) {
    if (!staticRooms) {
      const r = await fetch(import.meta.env.BASE_URL + 'site.json');
      staticRooms = (await r.json()).rooms;
    }
    const room = staticRooms.find((x) => x.id === Number(body.roomId));
    if (!room) throw new Error('That room is no longer available.');
    const nights = Math.round((Date.parse(body.checkOut) - Date.parse(body.checkIn)) / 86400000);
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const ref = 'KHS-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return { ...body, ref, roomName: room.name, nights, pricePerNight: room.price, total: room.price * nights, payment: body.payment || '' };
  }
  throw new Error('Something went wrong. Please call or WhatsApp the hotel.');
}
