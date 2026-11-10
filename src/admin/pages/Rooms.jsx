import { useState } from 'react';
import { kes } from '../../lib/format.js';
import { del, get, post, put } from '../api.js';
import { useAdmin } from '../context.js';
import { Field, ImagePicker, PageHead, Panel, useAsync } from '../ui.jsx';
import Icon from '../../components/Icon.jsx';
import { img } from '../../lib/img.js';

const BLANK = { name: '', price: 3000, maxGuests: 2, description: '', features: ['Double bed', 'Free Wi‑Fi'], image: '', active: true, sortOrder: 0 };

function RoomForm({ room, onClose, onSaved }) {
  const { notify } = useAdmin();
  const [f, setF] = useState({ ...room, featuresText: room.features.join(', ') });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      ...f,
      price: Number(f.price),
      maxGuests: Number(f.maxGuests),
      sortOrder: Number(f.sortOrder) || 0,
      features: f.featuresText.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (room.id) await put(`/rooms/${room.id}`, body);
      else await post('/rooms', body);
      notify(room.id ? 'Room saved.' : 'Room added.');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title={room.id ? `Edit ${room.name}` : 'Add a room'}
      onClose={onClose}
      footer={
        <button type="submit" form="room-form" className="a-btn a-btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save room'}
        </button>
      }
    >
      {error && <p className="a-err a-err-box">{error}</p>}
      <form id="room-form" className="a-form" onSubmit={save}>
        <div className="full">
          <ImagePicker value={f.image} onChange={(image) => setF((x) => ({ ...x, image }))} onError={setError} />
        </div>
        <Field label="Room name" full>
          <input value={f.name} onChange={set('name')} required />
        </Field>
        <Field label="Price per night (KES)">
          <input type="number" min="1" value={f.price} onChange={set('price')} required />
        </Field>
        <Field label="Max guests">
          <input type="number" min="1" max="12" value={f.maxGuests} onChange={set('maxGuests')} required />
        </Field>
        <Field label="Short description" full>
          <textarea rows={2} value={f.description} onChange={set('description')} />
        </Field>
        <Field label="Features" hint="Separate with commas, e.g. Double bed, Free Wi‑Fi, TV" full>
          <input value={f.featuresText} onChange={set('featuresText')} />
        </Field>
        <Field label="Display order" hint="Lower numbers show first.">
          <input type="number" value={f.sortOrder} onChange={set('sortOrder')} />
        </Field>
        <label className="a-check">
          <input type="checkbox" checked={f.active} onChange={set('active')} />
          <span>Show on website and accept bookings</span>
        </label>
      </form>
    </Panel>
  );
}

export default function Rooms() {
  const { notify } = useAdmin();
  const { data, error, reload } = useAsync(() => get('/rooms'), []);
  const [editing, setEditing] = useState(null);

  const toggle = async (r) => {
    try {
      await put(`/rooms/${r.id}`, { ...r, active: !r.active });
      notify(r.active ? `${r.name} hidden from the website.` : `${r.name} is live on the website.`);
      reload();
    } catch (e) {
      notify(e.message, 'error');
    }
  };
  const remove = async (r) => {
    if (!window.confirm(`Delete ${r.name}? This can’t be undone.`)) return;
    try {
      await del(`/rooms/${r.id}`);
      notify('Room deleted.');
      reload();
    } catch (e) {
      notify(e.message, 'error');
    }
  };

  return (
    <>
      <PageHead title="Rooms &amp; prices" subtitle="What guests can book, and what it costs.">
        <button type="button" className="a-btn a-btn-primary" onClick={() => setEditing(BLANK)}>
          <Icon name="plus" size={16} /> Add room
        </button>
      </PageHead>
      {error && <p className="a-err">{error}</p>}
      <div className="a-rooms">
        {data?.map((r) => (
          <article key={r.id} className={`a-room${r.active ? '' : ' is-hidden'}`}>
            {r.image ? <img src={img(r.image)} alt="" /> : <div className="img-empty">No photo</div>}
            <div className="a-room-body">
              <div className="a-room-top">
                <h2>{r.name}</h2>
                <span className={`badge ${r.active ? 'badge-confirmed' : 'badge-checked_out'}`}>{r.active ? 'Live' : 'Hidden'}</span>
              </div>
              <p className="a-room-price">
                {kes(r.price)} <small>/ night · up to {r.maxGuests}</small>
              </p>
              <p className="muted">{r.description}</p>
              <p className="muted small">{r.features.join(' · ')}</p>
              <div className="bk-actions">
                <button type="button" className="a-btn a-btn-primary" onClick={() => setEditing(r)}>Edit</button>
                <button type="button" className="a-btn" onClick={() => toggle(r)}>{r.active ? 'Hide' : 'Show'}</button>
                {r.bookingCount === 0 && (
                  <button type="button" className="a-btn a-btn-danger" onClick={() => remove(r)}>Delete</button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="muted small">
        Changing a price affects new bookings only. Existing bookings keep the rate they were made at. To show
        upcoming rooms without taking bookings, use <a href="#/settings">Settings → Coming soon</a>.
      </p>
      {editing && <RoomForm room={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </>
  );
}
