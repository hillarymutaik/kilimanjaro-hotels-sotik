import { Gallery, PageHeader } from '../components/Sections.jsx';
import { usePageTitle } from '../site/booking.js';

export default function GalleryPage() {
  usePageTitle('Gallery');
  return (
    <>
      <PageHeader eyebrow="Gallery" title="Relax and unwind" sub="A look inside our rooms and the guest sitting area. Tap a photo to enlarge it." />
      <Gallery />
    </>
  );
}
