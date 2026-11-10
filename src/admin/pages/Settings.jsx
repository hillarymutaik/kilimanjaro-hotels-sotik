import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { get, post, put } from '../api.js';
import { SITE_HOME, useAdmin } from '../context.js';
import { Avatar, Field, ImagePicker, PageHead, Spinner } from '../ui.jsx';
import { img } from '../../lib/img.js';

const ICONS = ['wifi', 'dining', 'parking', 'shower', 'events', 'clock', 'bed', 'heart', 'pin', 'phone', 'mail', 'users', 'calendar', 'check'];
const move = (arr, i, d) => {
  const a = [...arr];
  const j = i + d;
  if (j < 0 || j >= a.length) return a;
  [a[i], a[j]] = [a[j], a[i]];
  return a;
};

const TABS = [
  { id: 'profile', label: 'Profile', icon: 'user', hint: 'Your account and sign out' },
  { id: 'appearance', label: 'Appearance', icon: 'palette', hint: 'Light, dark or system' },
  { id: 'hotel', label: 'Hotel details', icon: 'building', hint: 'Contact details and times' },
  { id: 'content', label: 'Website content', icon: 'sparkle', hint: 'Payments, facilities, coming soon' },
  { id: 'photos', label: 'Photos', icon: 'image', hint: 'Banner, about and gallery' },
];
const CONTENT_TABS = ['hotel', 'content', 'photos'];

export default function Settings({ param }) {
  const tab = TABS.some((t) => t.id === param) ? param : 'profile';
  const { notify } = useAdmin();
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get('/settings')
      .then((d) => {
        setS(d);
        setSaved(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => (e.preventDefault(), (e.returnValue = ''));
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (fn) => {
    setS((cur) => fn(structuredClone(cur)));
    setDirty(true);
  };
  const discard = () => {
    setS(saved);
    setDirty(false);
    setError('');
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const next = await put('/settings', s);
      setS(next);
      setSaved(next);
      setDirty(false);
      notify('Settings saved. The website is updated.');
    } catch (e) {
      setError(e.message);
      notify(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const current = TABS.find((t) => t.id === tab);
  let body;
  if (tab === 'profile') body = <ProfileTab />;
  else if (tab === 'appearance') body = <AppearanceTab />;
  else if (!s) body = error ? <p className="a-err a-err-box">{error}</p> : <Spinner label="Loading settings" />;
  else if (tab === 'hotel') body = <HotelTab s={s} update={update} />;
  else if (tab === 'content') body = <ContentTab s={s} update={update} />;
  else body = <PhotosTab s={s} update={update} onError={setError} />;

  return (
    <>
      <PageHead title="Settings" subtitle="Your account, how the admin looks, and what guests see on the website." />
      <div className="a-settings">
        <nav className="a-settings-nav" aria-label="Settings sections">
          {TABS.map((t) => (
            <a key={t.id} href={`#/settings/${t.id}`} className={t.id === tab ? 'is-active' : ''} aria-current={t.id === tab ? 'page' : undefined}>
              <Icon name={t.icon} size={18} />
              <span>
                {t.label}
                <small>{t.hint}</small>
              </span>
            </a>
          ))}
        </nav>
        <div className="a-settings-body">
          <h2 className="a-settings-title">{current.label}</h2>
          {error && CONTENT_TABS.includes(tab) && s && <p className="a-err a-err-box">{error}</p>}
          {body}
        </div>
      </div>

      {dirty && (
        <div className="a-savebar" role="region" aria-label="Unsaved changes">
          <span>
            <strong>Unsaved changes.</strong> The website updates when you save.
          </span>
          <div>
            <button type="button" className="a-btn" onClick={discard} disabled={busy}>
              Discard
            </button>
            <button type="button" className="a-btn a-btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ProfileTab() {
  const { user, logout } = useAdmin();
  return (
    <>
      <section className="a-card a-profile">
        <Avatar name={user.username} />
        <div className="a-profile-main">
          <span className="a-eyebrow">Signed in as</span>
          <strong>{user.username}</strong>
          <span className="muted">Administrator · full access to bookings, rooms and settings</span>
        </div>
        <div className="a-profile-actions">
          <a className="a-btn" href={SITE_HOME} target="_blank" rel="noopener">
            <Icon name="external" size={16} /> View website
          </a>
          <button type="button" className="a-btn a-btn-danger" onClick={logout}>
            <Icon name="logout" size={16} /> Log out
          </button>
        </div>
      </section>
      <PasswordCard />
    </>
  );
}

const THEME_OPTIONS = [
  { id: 'system', label: 'System', icon: 'monitor', text: 'Match this device’s setting.' },
  { id: 'light', label: 'Light', icon: 'sun', text: 'Bright, best in daylight.' },
  { id: 'dark', label: 'Dark', icon: 'moon', text: 'Easy on the eyes at night.' },
];

function AppearanceTab() {
  const { theme, setTheme } = useAdmin();
  return (
    <section className="a-card">
      <h3 className="a-card-title">Theme</h3>
      <p className="muted a-card-lead">Choose how the admin panel looks. This is saved on this device only and doesn’t change the website.</p>
      <div className="a-theme-grid" role="radiogroup" aria-label="Theme">
        {THEME_OPTIONS.map((o) => (
          <label key={o.id} className={`a-theme-option${theme === o.id ? ' is-active' : ''}`}>
            <input type="radio" name="theme" value={o.id} checked={theme === o.id} onChange={() => setTheme(o.id)} />
            <span className="a-theme-preview" aria-hidden="true">
              {o.id === 'system' ? (
                <>
                  <MiniPreview mode="light" />
                  <MiniPreview mode="dark" />
                </>
              ) : (
                <MiniPreview mode={o.id} />
              )}
            </span>
            <span className="a-theme-label">
              <Icon name={o.icon} size={16} /> {o.label}
              {theme === o.id && <Icon name="check" size={16} className="a-theme-check" />}
            </span>
            <small>{o.text}</small>
          </label>
        ))}
      </div>
    </section>
  );
}

/** A tiny drawing of the admin: sidebar strip and two cards. */
function MiniPreview({ mode }) {
  return (
    <span className={`a-mini a-mini-${mode}`}>
      <i />
      <b />
      <b />
    </span>
  );
}

function HotelTab({ s, update }) {
  const hotel = (k) => (e) => update((x) => ((x.hotel[k] = e.target.value), x));
  return (
    <>
      <section className="a-card">
        <h3 className="a-card-title">Name and location</h3>
        <div className="a-form">
          <Field label="Hotel name"><input value={s.hotel.name} onChange={hotel('name')} /></Field>
          <Field label="Town"><input value={s.hotel.town} onChange={hotel('town')} /></Field>
          <Field label="Location" full><input value={s.hotel.location} onChange={hotel('location')} /></Field>
          <Field label="Address note / directions" full hint="Shown on the Contact page.">
            <input value={s.hotel.addressNote} onChange={hotel('addressNote')} />
          </Field>
          <Field label="Google Maps link" full hint="Paste the Share link from Google Maps.">
            <input value={s.hotel.mapsUrl} onChange={hotel('mapsUrl')} />
          </Field>
        </div>
      </section>
      <section className="a-card">
        <h3 className="a-card-title">Contact</h3>
        <div className="a-form">
          <Field label="Phone (as displayed)"><input value={s.hotel.phoneDisplay} onChange={hotel('phoneDisplay')} /></Field>
          <Field label="WhatsApp number" hint="International format, no + or spaces, e.g. 254700262745. Booking requests go here.">
            <input value={s.hotel.whatsapp} inputMode="numeric" onChange={hotel('whatsapp')} />
          </Field>
          <Field label="Email" full><input type="email" value={s.hotel.email} onChange={hotel('email')} /></Field>
        </div>
      </section>
      <section className="a-card">
        <h3 className="a-card-title">Check-in and check-out</h3>
        <div className="a-form">
          <Field label="Check-in from"><input value={s.hotel.checkIn} onChange={hotel('checkIn')} /></Field>
          <Field label="Check-out by"><input value={s.hotel.checkOut} onChange={hotel('checkOut')} /></Field>
        </div>
      </section>
    </>
  );
}

function ContentTab({ s, update }) {
  return (
    <>
      <section className="a-card">
        <h3 className="a-card-title">Payment methods</h3>
        <p className="muted a-card-lead">Shown to guests on the booking form.</p>
        <ul className="a-edit-list">
          {s.paymentMethods.map((p, i) => (
            <li key={i}>
              <input value={p} aria-label={`Payment method ${i + 1}`} onChange={(e) => update((x) => ((x.paymentMethods[i] = e.target.value), x))} />
              <button type="button" className="icon-btn" aria-label="Remove" onClick={() => update((x) => (x.paymentMethods.splice(i, 1), x))}><Icon name="close" size={16} /></button>
            </li>
          ))}
        </ul>
        <button type="button" className="a-btn" onClick={() => update((x) => (x.paymentMethods.push(''), x))}><Icon name="plus" size={16} /> Add method</button>
      </section>

      <section className="a-card">
        <h3 className="a-card-title">Facilities</h3>
        <p className="muted a-card-lead">Listed on the home page and the Amenities page, in this order.</p>
        <ul className="a-edit-list">
          {s.amenities.map((a, i) => (
            <li key={i} className="a-amen-row">
              <select value={a.icon} aria-label="Icon" onChange={(e) => update((x) => ((x.amenities[i].icon = e.target.value), x))}>
                {ICONS.map((ic) => <option key={ic}>{ic}</option>)}
              </select>
              <input value={a.title} placeholder="Title" aria-label="Title" onChange={(e) => update((x) => ((x.amenities[i].title = e.target.value), x))} />
              <input value={a.text} placeholder="Short description" aria-label="Description" onChange={(e) => update((x) => ((x.amenities[i].text = e.target.value), x))} />
              <button type="button" className="icon-btn" aria-label="Move up" onClick={() => update((x) => ((x.amenities = move(x.amenities, i, -1)), x))}>↑</button>
              <button type="button" className="icon-btn" aria-label="Remove" onClick={() => update((x) => (x.amenities.splice(i, 1), x))}><Icon name="close" size={16} /></button>
            </li>
          ))}
        </ul>
        <button type="button" className="a-btn" onClick={() => update((x) => (x.amenities.push({ icon: 'check', title: '', text: '' }), x))}><Icon name="plus" size={16} /> Add facility</button>
      </section>

      <section className="a-card">
        <h3 className="a-card-title">Coming soon rooms</h3>
        <div className="a-form">
          <label className="a-check full">
            <input type="checkbox" checked={!!s.comingSoon.enabled} onChange={(e) => update((x) => ((x.comingSoon.enabled = e.target.checked), x))} />
            <span>Show the “coming soon” box under the rooms</span>
          </label>
          <Field label="Title"><input value={s.comingSoon.title} onChange={(e) => update((x) => ((x.comingSoon.title = e.target.value), x))} /></Field>
          <Field label="Price per night (KES)"><input type="number" min="0" value={s.comingSoon.price} onChange={(e) => update((x) => ((x.comingSoon.price = e.target.value), x))} /></Field>
          <Field label="Text" full><textarea rows={2} value={s.comingSoon.text} onChange={(e) => update((x) => ((x.comingSoon.text = e.target.value), x))} /></Field>
        </div>
      </section>
    </>
  );
}

function PhotosTab({ s, update, onError }) {
  return (
    <>
      <section className="a-card">
        <h3 className="a-card-title">Page photos</h3>
        <div className="a-two">
          <div>
            <h4>Top banner</h4>
            <ImagePicker value={s.images.hero} onChange={(url) => update((x) => ((x.images.hero = url), x))} onError={onError} />
          </div>
          <div>
            <h4>About section</h4>
            <ImagePicker value={s.images.about} onChange={(url) => update((x) => ((x.images.about = url), x))} onError={onError} />
          </div>
        </div>
      </section>
      <section className="a-card">
        <h3 className="a-card-title">Gallery</h3>
        <p className="muted a-card-lead">A short description helps guests using screen readers.</p>
        <ul className="a-gallery">
          {s.gallery.map((g, i) => (
            <li key={i}>
              <img src={img(g.src)} alt="" />
              <input value={g.alt} placeholder="Describe the photo" aria-label="Photo description" onChange={(e) => update((x) => ((x.gallery[i].alt = e.target.value), x))} />
              <div>
                <button type="button" className="icon-btn" aria-label="Move left" onClick={() => update((x) => ((x.gallery = move(x.gallery, i, -1)), x))}>←</button>
                <button type="button" className="icon-btn" aria-label="Move right" onClick={() => update((x) => ((x.gallery = move(x.gallery, i, 1)), x))}>→</button>
                <button type="button" className="icon-btn" aria-label="Remove photo" onClick={() => update((x) => (x.gallery.splice(i, 1), x))}><Icon name="close" size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
        <ImagePicker label="Gallery photo" value="" onChange={(url) => update((x) => (x.gallery.push({ src: url, alt: '' }), x))} onError={onError} />
      </section>
    </>
  );
}

function PasswordCard() {
  const { notify } = useAdmin();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (f.next !== f.confirm) return setError('The new passwords don’t match.');
    setBusy(true);
    try {
      await post('/password', { current: f.current, next: f.next });
      setF({ current: '', next: '', confirm: '' });
      notify('Password changed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="a-card">
      <h3 className="a-card-title">
        <Icon name="lock" size={18} /> Change password
      </h3>
      <form className="a-form" onSubmit={submit}>
        <Field label="Current password" full>
          <input type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required />
        </Field>
        <Field label="New password" hint="At least 8 characters.">
          <input type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required minLength={8} />
        </Field>
        <Field label="Repeat new password">
          <input type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
        </Field>
        <p className="a-err full">{error}</p>
        <div className="full">
          <button className="a-btn a-btn-primary" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</button>
        </div>
      </form>
    </section>
  );
}
