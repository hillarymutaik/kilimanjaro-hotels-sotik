import { createContext, useContext, useEffect, useState } from 'react';
import { SUPABASE, check, supabase } from '../lib/supabase.js';
import { img } from '../lib/img.js';

// Shown only if the API can't be reached, so guests can still contact the hotel.
const FALLBACK_CONTACT = { name: 'Kilimanjaro Hotels', phoneDisplay: '+254 700 262 745', whatsapp: '254700262745' };

// Where the data comes from:
// - Supabase (GitHub Pages with VITE_SUPABASE_URL/KEY): live data, bookings saved, admin panel works.
// - STATIC (GitHub Pages without Supabase): content from site.json, every room shows as available,
//   booking requests go to WhatsApp only.
// - otherwise the Node server's /api.
export const STATIC = import.meta.env.VITE_STATIC === '1' && !SUPABASE;

const SiteContext = createContext(null);

function shape(d) {
  return {
    HOTEL: { ...d.hotel, phoneTel: '+' + d.hotel.whatsapp },
    IMAGES: { hero: img(d.images.hero), lounge: img(d.images.about) },
    ROOMS: d.rooms.map((r) => ({ ...r, image: img(r.image) })),
    AMENITIES: d.amenities,
    GALLERY: d.gallery.map((g) => ({ ...g, src: img(g.src) })),
    PAYMENT_METHODS: d.paymentMethods,
    COMING_SOON: d.comingSoon,
  };
}

async function loadSite() {
  if (SUPABASE) {
    const d = check(await supabase.rpc('get_site'));
    if (!d) throw new Error('Site content missing: run supabase/schema.sql.');
    return d;
  }
  const r = await fetch(STATIC ? import.meta.env.BASE_URL + 'site.json' : '/api/site');
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export function SiteProvider({ children }) {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    loadSite()
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
  if (SUPABASE) return supabaseApi(path, body);
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

/** The public API as Supabase database functions (see supabase/schema.sql). */
async function supabaseApi(path, body) {
  if (path.startsWith('/availability')) {
    const q = new URLSearchParams(path.split('?')[1]);
    return check(await supabase.rpc('get_availability', { p_check_in: q.get('checkIn'), p_check_out: q.get('checkOut') }));
  }
  if (path === '/bookings' && body) return check(await supabase.rpc('create_booking', { p: body }));
  throw new Error('Something went wrong. Please call or WhatsApp the hotel.');
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
