import { About, Highlights, PageHeader } from '../components/Sections.jsx';
import { usePageTitle } from '../site/booking.js';

export default function AboutPage() {
  usePageTitle('About');
  return (
    <>
      <PageHeader eyebrow="About the hotel" title="Welcome to Kilimanjaro Hotels" sub="A warm welcome and a comfortable stay in Sotik, Bomet County." />
      <About />
      <Highlights />
    </>
  );
}
