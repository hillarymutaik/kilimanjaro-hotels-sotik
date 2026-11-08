import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { get, post, put } from '../api.js';
import { useAdmin } from '../context.js';
import { Field, ImagePicker } from '../ui.jsx';

const ICONS = ['wifi', 'dining', 'parking', 'shower', 'events', 'clock', 'bed', 'heart', 'pin', 'phone', 'mail', 'users', 'calendar', 'check'];
const move = (arr, i, d) => {
  const a = [...arr];
  const j = i + d;
  if (j < 0 || j >= a.length) return a;
  [a[i], a[j]] = [a[j], a[i]];
  return a;
};

export default function Settings() {
  const { notify } = useAdmin();
  const [s, setS] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    get('/settings').then(setS).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => (e.preventDefault(), (e.returnValue = ''));
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!s) return error ? <p className="a-err">{error}</p> : <p>Loading…</p>;

  const update = (fn) => {
    setS((cur) => fn(structuredClone(cur)));
    setDirty(true);
  };
  const hotel = (k) => (e) => update((x) => ((x.hotel[k] = e.target.value), x));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      setS(await put('/settings', s));
      setDirty(false);
      notify('Settings saved. The website is updated.');
    } catch (e) {
      setError(e.message);
      notify(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="a-page-head">
        <h1>Settings</h1>
        <div className="a-head-actions">
          {dirty && <span className="muted">Unsaved changes</span>}
          <button type="button" className="a-btn a-btn-primary" onClick={save} disabled={busy || !dirty}>
            {busy ? 'Saving…' : 'Save all changes'}
          </button>
        </div>
      </div>
      {error && <p className="a-err a-err-box">{error}</p>}

      <section className="a-card">
        <h2>Hotel details</h2>
        <div className="a-form">
          <Field label="Hotel name"><input value={s.hotel.name} onChange={hotel('name')} /></Field>
          <Field label="Town"><input value={s.hotel.town} onChange={hotel('town')} /></Field>
          <Field label="Location" full><input value={s.hotel.location} onChange={hotel('location')} /></Field>
          <Field label="Address note / directions" full><input value={s.hotel.addressNote} onChange={hotel('addressNote')} /></Field>
          <Field label="Phone (as displayed)"><input value={s.hotel.phoneDisplay} onChange={hotel('phoneDisplay')} /></Field>
          <Field label="WhatsApp number" hint="International format, no + or spaces, e.g. 254700262745. Booking requests go here.">
            <input value={s.hotel.whatsapp} inputMode="numeric" onChange={hotel('whatsapp')} />
          </Field>
          <Field label="Email"><input type="email" value={s.hotel.email} onChange={hotel('email')} /></Field>
          <Field label="Google Maps link"><input value={s.hotel.mapsUrl} onChange={hotel('mapsUrl')} /></Field>
          <Field label="Check-in from"><input value={s.hotel.checkIn} onChange={hotel('checkIn')} /></Field>
          <Field label="Check-out by"><input value={s.hotel.checkOut} onChange={hotel('checkOut')} /></Field>
        </div>
      </section>

      <section className="a-card">
        <h2>Coming soon rooms</h2>
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

      <section className="a-card">
        <h2>Payment methods</h2>
        <p className="muted">Shown to guests on the booking form.</p>
        <ul className="a-edit-list">
          {s.paymentMethods.map((p, i) => (
            <li key={i}>
              <input value={p} aria-label={`Payment method ${i + 1}`} onChange={(e) => update((x) => ((x.paymentMethods[i] = e.target.value), x))} />
              <button type="button" className="icon-btn" aria-label="Remove" onClick={() => update((x) => (x.paymentMethods.splice(i, 1), x))}><Icon name="close" size={16} /></button>
            </li>
          ))}
        </ul>
        <button type="button" className="a-btn" onClick={() => update((x) => (x.paymentMethods.push(''), x))}>+ Add method</button>
      </section>

      <section className="a-card">
        <h2>Facilities</h2>
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
        <button type="button" className="a-btn" onClick={() => update((x) => (x.amenities.push({ icon: 'check', title: '', text: '' }), x))}>+ Add facility</button>
      </section>

      <section className="a-card">
        <h2>Website photos</h2>
        <div className="a-two">
          <div>
            <h3>Top banner</h3>
            <ImagePicker value={s.images.hero} onChange={(url) => update((x) => ((x.images.hero = url), x))} onError={setError} />
          </div>
          <div>
            <h3>About section</h3>
            <ImagePicker value={s.images.about} onChange={(url) => update((x) => ((x.images.about = url), x))} onError={setError} />
          </div>
        </div>
        <h3>Gallery</h3>
        <ul className="a-gallery">
          {s.gallery.map((g, i) => (
            <li key={i}>
              <img src={g.src} alt="" />
              <input value={g.alt} placeholder="Describe the photo" aria-label="Photo description" onChange={(e) => update((x) => ((x.gallery[i].alt = e.target.value), x))} />
              <div>
                <button type="button" className="icon-btn" aria-label="Move left" onClick={() => update((x) => ((x.gallery = move(x.gallery, i, -1)), x))}>←</button>
                <button type="button" className="icon-btn" aria-label="Move right" onClick={() => update((x) => ((x.gallery = move(x.gallery, i, 1)), x))}>→</button>
                <button type="button" className="icon-btn" aria-label="Remove photo" onClick={() => update((x) => (x.gallery.splice(i, 1), x))}><Icon name="close" size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
        <ImagePicker label="Gallery photo" value="" onChange={(url) => update((x) => (x.gallery.push({ src: url, alt: '' }), x))} onError={setError} />
      </section>

      <PasswordCard />
    </>
  );
}

function PasswordCard() {
  const { notify } = useAdmin();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (f.next !== f.confirm) return setError('The new passwords don’t match.');
    try {
      await post('/password', { current: f.current, next: f.next });
      setF({ current: '', next: '', confirm: '' });
      notify('Password changed.');
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <section className="a-card">
      <h2>Change admin password</h2>
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
          <button className="a-btn a-btn-primary">Change password</button>
        </div>
      </form>
    </section>
  );
}
