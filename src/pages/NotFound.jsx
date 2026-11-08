import { Link } from 'react-router-dom';
import { PageHeader } from '../components/Sections.jsx';
import { usePageTitle } from '../site/booking.js';

export default function NotFound() {
  usePageTitle('Page not found');
  return (
    <>
      <PageHeader title="Page not found" sub="The page you’re looking for doesn’t exist or has moved." />
      <section className="section">
        <div className="wrap center-cta">
          <Link className="btn btn-primary" to="/">Back to home</Link>
          <Link className="btn btn-ghost-dark" to="/rooms">View rooms</Link>
        </div>
      </section>
    </>
  );
}
