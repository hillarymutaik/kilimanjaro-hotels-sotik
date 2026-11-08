import { Contact, PageHeader } from '../components/Sections.jsx';
import { usePageTitle } from '../site/booking.js';

export default function ContactPage() {
  usePageTitle('Contact');
  return (
    <>
      <PageHeader eyebrow="Get in touch" title="We’d love to hear from you" sub="Contact us for room availability, group bookings, events and directions." />
      <Contact />
    </>
  );
}
