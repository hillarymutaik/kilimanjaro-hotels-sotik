import { useCallback, useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { AdminContext } from './context.js';
import { get, post, setUnauthorizedHandler } from './api.js';
import { Toast } from './ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Bookings from './pages/Bookings.jsx';
import Calendar from './pages/Calendar.jsx';
import Rooms from './pages/Rooms.jsx';
import Settings from './pages/Settings.jsx';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'clock' },
  { id: 'bookings', label: 'Bookings', icon: 'calendar' },
  { id: 'calendar', label: 'Availability', icon: 'bed' },
  { id: 'rooms', label: 'Rooms & prices', icon: 'parking' },
  { id: 'settings', label: 'Settings', icon: 'events' },
];
const PAGES = { dashboard: Dashboard, bookings: Bookings, calendar: Calendar, rooms: Rooms, settings: Settings };

function readRoute() {
  const [page, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  return { page: PAGES[page] ? page : 'dashboard', param: rest.join('/') };
}

export default function AdminApp() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = logged out
  const [route, setRoute] = useState(readRoute);
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    get('/me').then(setUser).catch(() => setUser(null));
    const onHash = () => {
      setRoute(readRoute());
      setMenuOpen(false);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const notify = useCallback((message, type = 'ok') => setToast({ message, type, at: Date.now() }), []);
  const clearToast = useCallback(() => setToast(null), []);
  const go = useCallback((page, param = '') => {
    location.hash = `#/${page}${param ? '/' + param : ''}`;
  }, []);

  if (user === undefined) return <div className="a-boot">Loading…</div>;
  if (!user) return <Login onLogin={setUser} />;

  const Page = PAGES[route.page];
  const logout = async () => {
    await post('/logout').catch(() => {});
    setUser(null);
  };

  return (
    <AdminContext.Provider value={{ user, notify, go }}>
      <div className="a-shell">
        <aside className={`a-side${menuOpen ? ' is-open' : ''}`}>
          <div className="a-brand">
            <span>Kilimanjaro Hotels</span>
            <small>Sotik · Admin</small>
          </div>
          <nav aria-label="Admin">
            {NAV.map((n) => (
              <a key={n.id} href={`#/${n.id}`} className={route.page === n.id ? 'is-active' : ''} aria-current={route.page === n.id ? 'page' : undefined}>
                <Icon name={n.icon} size={18} /> {n.label}
              </a>
            ))}
          </nav>
          <div className="a-side-foot">
            <a href="/" target="_blank" rel="noopener">
              View website ↗
            </a>
            <span className="a-user">Signed in as {user.username}</span>
            <button type="button" className="a-btn a-btn-ghost" onClick={logout}>
              Log out
            </button>
          </div>
        </aside>
        <div className="a-main">
          <header className="a-topbar">
            <button type="button" className="icon-btn" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              <Icon name={menuOpen ? 'close' : 'menu'} />
            </button>
            <strong>{NAV.find((n) => n.id === route.page)?.label}</strong>
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
  const [username, setUsername] = useState('admin');
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
        <div className="a-brand">
          <span>Kilimanjaro Hotels</span>
          <small>Sotik · Admin</small>
        </div>
        <h1>Sign in</h1>
        <label className="a-field">
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label className="a-field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required autoFocus />
        </label>
        <p className="a-err" role="alert">
          {error}
        </p>
        <button className="a-btn a-btn-primary a-btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <a className="a-login-back" href="/">
          ← Back to website
        </a>
      </form>
    </div>
  );
}
