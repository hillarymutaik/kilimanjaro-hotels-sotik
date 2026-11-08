import { createContext, useContext, useEffect } from 'react';
import { useSite } from './SiteContext.jsx';

// Stay dates, guests and the booking modal are shared by every page,
// so a search on the home page carries over to the Rooms page.
export const BookingContext = createContext(null);
export const useBooking = () => useContext(BookingContext);

/** Sets the browser tab title for a page. */
export function usePageTitle(title) {
  const { HOTEL } = useSite();
  useEffect(() => {
    document.title = title ? `${title} | ${HOTEL.name} ${HOTEL.town}` : `${HOTEL.name} ${HOTEL.town} | Book your stay`;
  }, [title, HOTEL]);
}
