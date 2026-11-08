import { createContext, useContext, useEffect, useState } from 'react';

// Shown only if the API can't be reached, so guests can still contact the hotel.
const FALLBACK_CONTACT = { name: 'Kilimanjaro Hotels', phoneDisplay: '+254 700 262 745', whatsapp: '254700262745' };

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
    fetch('/api/site')
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
  const r = await fetch('/api' + path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong. Please try again, or call the hotel.');
  return data;
}
