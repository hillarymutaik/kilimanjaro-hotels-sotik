import { Amenities, CtaBand, PageHeader } from '../components/Sections.jsx';
import { usePageTitle } from '../site/booking.js';

export default function AmenitiesPage() {
  usePageTitle('Amenities');
  return (
    <>
      <PageHeader eyebrow="Facilities" title="What’s included" sub="Every stay comes with the basics done well." />
      <Amenities />
      <CtaBand />
    </>
  );
}
