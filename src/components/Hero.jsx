import { Link } from 'react-router-dom';
import { useSite } from '../site/SiteContext.jsx';

export default function Hero() {
  const { HOTEL, IMAGES, ROOMS, AMENITIES, GALLERY, PAYMENT_METHODS, COMING_SOON } = useSite();
  return (
    <section className="hero" id="home" aria-labelledby="hero-title">
      <div className="hero-bg" aria-hidden="true">
        <i className="hero-cover" style={{ backgroundImage: `url(${IMAGES.hero})` }} />
        <i className="hero-shade" />
      </div>
      <div className="wrap hero-copy">
        <p className="eyebrow">Welcome to {HOTEL.name} · {HOTEL.town}</p>
        <h1 id="hero-title">A warm welcome. A comfortable stay.</h1>
        <p className="hero-lead">
          Your stay in Sotik starts here. Comfortable rooms, hot meals and friendly service, minutes from the tea country of Kericho and Bomet.
        </p>
        <div className="hero-ctas">
          <Link className="btn btn-primary" to="/rooms">
            Explore rooms
          </Link>
          <Link className="btn btn-ghost" to="/contact">
            Contact the hotel
          </Link>
        </div>
      </div>
    </section>
  );
}
