import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header.jsx';
import BookingModal from './components/BookingModal.jsx';
import { Footer, WhatsAppFab } from './components/Sections.jsx';
import { addDays, nightsBetween, todayISO } from './lib/format.js';
import { api } from './site/SiteContext.jsx';
import { BookingContext } from './site/booking.js';
import Home from './pages/Home.jsx';
import RoomsPage from './pages/RoomsPage.jsx';
import AmenitiesPage from './pages/AmenitiesPage.jsx';
import GalleryPage from './pages/GalleryPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import NotFound from './pages/NotFound.jsx';

function initialTheme() {
  try {
    const saved = localStorage.getItem('khs-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable */
  }
  return 'light';
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [stay, setStay] = useState(() => {
    const t = todayISO();
    return { checkIn: t, checkOut: addDays(t, 1), guests: 2 };
  });
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [room, setRoom] = useState(null);
  const [unavailable, setUnavailable] = useState([]);
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('khs-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const nights = nightsBetween(stay.checkIn, stay.checkOut);

  // After a search, keep availability in sync with the chosen dates.
  useEffect(() => {
    if (!searched || nights < 1) return;
    let alive = true;
    api(`/availability?checkIn=${stay.checkIn}&checkOut=${stay.checkOut}`)
      .then((d) => alive && setUnavailable(d.unavailable))
      .catch(() => alive && setUnavailable([]));
    return () => {
      alive = false;
    };
  }, [searched, stay.checkIn, stay.checkOut, nights]);

  const changeStay = useCallback((s) => {
    setStay(s);
    setSearchError('');
  }, []);

  /** Validate dates; on success show the rooms list for those dates. */
  const search = () => {
    if (!stay.checkIn || !stay.checkOut) return setSearchError('Choose your check-in and check-out dates.');
    if (stay.checkIn < todayISO()) return setSearchError('Check-in cannot be in the past.');
    if (nights < 1) return setSearchError('Check-out must be after check-in.');
    setSearchError('');
    setSearched(true);
    if (pathname !== '/rooms') navigate('/rooms');
    else document.getElementById('room-list')?.scrollIntoView({ behavior: 'smooth' });
  };

  const book = (r) => {
    if (nights < 1) {
      setSearchError('Choose valid dates first.');
      document.getElementById('book')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSearchError('');
    setRoom(r);
  };

  const closeModal = useCallback(() => setRoom(null), []);

  const value = { stay, changeStay, nights, searched, searchError, unavailable, search, book };

  return (
    <BookingContext.Provider value={value}>
      <ScrollToTop />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/amenities" element={<AmenitiesPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <WhatsAppFab />
      {room && <BookingModal room={room} stay={stay} onStayChange={setStay} onClose={closeModal} />}
    </BookingContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <Layout />
    </BrowserRouter>
  );
}
