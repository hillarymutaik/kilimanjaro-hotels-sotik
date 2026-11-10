import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import LogoMark from '../components/LogoMark.jsx';
import { AdminContext, SITE_HOME } from './context.js';
import { get, post, setUnauthorizedHandler } from './api.js';
import { SUPABASE } from '../lib/supabase.js';
import { useThemePref } from './theme.js';
import { Avatar, Spinner, Toast } from './ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Bookings from './pages/Bookings.jsx';
import Calendar from './pages/Calendar.jsx';
import Rooms from './pages/Rooms.jsx';
import Settings from './pages/Settings.jsx';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'bookings', label: 'Bookings', icon: 'list' },
  { id: 'calendar', label: 'Availability', icon: 'calendar' },
  { id: 'rooms', label: 'Rooms & prices', icon: 'bed' },
  { id: 'settings', label: 'Settings', icon: 'sliders' },
];
const PAGES = { dashboard: Dashboard, bookings: Bookings, calendar: Calendar, rooms: Rooms, settings: Settings };

function readRoute() {
  const [page, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  return { page: PAGES[page] ? page : 'dashboard', param: rest.join('/') };
}

/** Logo and name, used in the sidebar and on the sign-in card. */
function Brand() {
  return (
    <div className="a-brand">
      <LogoMark />
      <div>
        <span>Kilimanjaro Hotels</span>
        <small>Sotik · Admin</small>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = logged out
  const [route, setRoute] = useState(readRoute);
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useThemePref();

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    get('/me').then(setUser).catch(() => setUser(null));
    const onHash = () => {
      setRoute(readRoute());
      setMenuOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const notify = useCallback((message, type = 'ok') => setToast({ message, type, at: Date.now() }), []);
  const clearToast = useCallback(() => setToast(null), []);
  const go = useCallback((page, param = '') => {
    location.hash = `#/${page}${param ? '/' + param : ''}`;
  }, []);
  const logout = useCallback(async () => {
    await post('/logout').catch(() => {});
    setUser(null);
    location.hash = '';
  }, []);

  if (user === undefined) {
    return (
      <div className="a-boot">
        <Spinner label="Loading the admin panel" />
      </div>
    );
  }
  if (!user) return <Login onLogin={setUser} />;

  const Page = PAGES[route.page];
  const current = NAV.find((n) => n.id === route.page);

  return (
    <AdminContext.Provider value={{ user, notify, go, logout, theme, setTheme }}>
      <div className="a-shell">
        <aside className={`a-side${menuOpen ? ' is-open' : ''}`} aria-label="Main menu">
          <Brand />
          <nav aria-label="Admin">
            {NAV.map((n) => (
              <a key={n.id} href={`#/${n.id}`} className={route.page === n.id ? 'is-active' : ''} aria-current={route.page === n.id ? 'page' : undefined}>
                <Icon name={n.icon} size={18} /> {n.label}
              </a>
            ))}
          </nav>
          <a className="a-profile-chip" href="#/settings/profile" title="Profile and sign out">
            <Avatar name={user.username} />
            <span className="a-profile-chip-text">
              <strong>{user.username}</strong>
              <small>Profile &amp; sign out</small>
            </span>
            <Icon name="right" size={16} />
          </a>
        </aside>
        {menuOpen && <div className="a-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
        <div className="a-main">
          <header className="a-topbar">
            <button type="button" className="icon-btn" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              <Icon name={menuOpen ? 'close' : 'menu'} />
            </button>
            <LogoMark className="a-topbar-logo" />
            <strong>{current?.label}</strong>
            <a className="a-topbar-avatar" href="#/settings/profile" aria-label="Profile">
              <Avatar name={user.username} small />
            </a>
          </header>
          <main className="a-content">
            <Page param={route.param} />
          </main>
        </div>
      </div>
      <Toast toast={toast} onDone={clearToast} />
    </AdminContext.Provider>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState(SUPABASE ? '' : 'admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await post('/login', { username, password }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="a-login">
      <form className="a-login-card" onSubmit={submit}>
        <Brand />
        <div>
          <h1>Welcome back</h1>
          <p className="muted">Sign in to manage bookings, rooms and the website.</p>
        </div>
        <label className="a-field">
          <span>{SUPABASE ? 'Email' : 'Username'}</span>
          <input type={SUPABASE ? 'email' : 'text'} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus={SUPABASE} />
        </label>
        <label className="a-field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required autoFocus={!SUPABASE} />
        </label>
        <p className="a-err" role="alert">
          {error}
        </p>
        <button className="a-btn a-btn-primary a-btn-block a-btn-lg" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <a className="a-login-back" href={SITE_HOME}>
          ← Back to website
        </a>
      </form>
    </div>
  );
}
