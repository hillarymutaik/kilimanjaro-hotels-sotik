import Hero from '../components/Hero.jsx';
import SearchBar from '../components/SearchBar.jsx';
import { CtaBand, Highlights, RoomsPreview } from '../components/Sections.jsx';
import { useBooking, usePageTitle } from '../site/booking.js';

// Kept short on purpose: welcome, date search, why us, a peek at the rooms,
// and a way to get in touch. Everything else lives on its own page.
export default function Home() {
  usePageTitle('');
  const { stay, changeStay, search, searchError } = useBooking();
  return (
    <>
      <Hero />
      <SearchBar stay={stay} onChange={changeStay} onSubmit={search} error={searchError} />
      <Highlights />
      <RoomsPreview />
      <CtaBand />
    </>
  );
}
