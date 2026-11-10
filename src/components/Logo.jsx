import { Link } from 'react-router-dom';
import { useSite } from '../site/SiteContext.jsx';
import LogoMark from './LogoMark.jsx';

export default function Logo() {
  const { HOTEL } = useSite();
  return (
    <Link className="logo" to="/" aria-label={`${HOTEL.name} ${HOTEL.town}, home`}>
      <LogoMark />
      <span>
        {HOTEL.name}
        <small>{HOTEL.town} · Kenya</small>
      </span>
    </Link>
  );
}
