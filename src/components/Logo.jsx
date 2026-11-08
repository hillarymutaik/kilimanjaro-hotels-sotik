import { Link } from 'react-router-dom';
import { useSite } from '../site/SiteContext.jsx';

export default function Logo() {
  const { HOTEL, IMAGES, ROOMS, AMENITIES, GALLERY, PAYMENT_METHODS, COMING_SOON } = useSite();
  return (
    <Link className="logo" to="/" aria-label={`${HOTEL.name} ${HOTEL.town}, home`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="#1f5246" stroke="#d6ad62" strokeWidth="2" />
        <circle cx="41" cy="24" r="6" fill="#d6ad62" />
        <path d="M10 48L22 34L28 22H40L46 32L54 48Z" fill="#2f6b58" />
        <path d="M28 22H40L43 28L38 26L34 30L31 26L26 28Z" fill="#f7f5ef" />
        <path d="M4 46Q32 41 60 46A30 30 0 0 1 4 46Z" fill="#163a31" />
      </svg>
      <span>
        {HOTEL.name}
        <small>{HOTEL.town} · Kenya</small>
      </span>
    </Link>
  );
}
