import Rooms from '../components/Rooms.jsx';
import SearchBar from '../components/SearchBar.jsx';
import { PageHeader } from '../components/Sections.jsx';
import { useBooking, usePageTitle } from '../site/booking.js';

export default function RoomsPage() {
  usePageTitle('Rooms');
  const { stay, changeStay, search, searchError, nights, searched, unavailable, book } = useBooking();
  return (
    <>
      <PageHeader eyebrow="Accommodation" title="Our rooms" sub="Choose your dates, pick a room and send your booking request in a minute." />
      <SearchBar stay={stay} onChange={changeStay} onSubmit={search} error={searchError} />
      <Rooms stay={stay} nights={nights} searched={searched} unavailable={unavailable} onBook={book} />
    </>
  );
}
