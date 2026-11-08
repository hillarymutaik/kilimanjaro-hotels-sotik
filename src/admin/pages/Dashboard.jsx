import { useState } from 'react';
import { formatDate, kes, plural } from '../../lib/format.js';
import { get } from '../api.js';
import BookingPanel from '../BookingPanel.jsx';
import { Empty, StatusBadge, useAsync } from '../ui.jsx';

function List({ title, items, empty, onOpen, show = 'stay' }) {
  return (
    <section className="a-card">
      <h2>
        {title} <span className="count">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <ul className="a-list">
          {items.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => onOpen(b.id)}>
                <span className="a-list-main">
                  <strong>{b.name}</strong>
                  <span className="muted">
                    {b.roomName} · {show === 'created' ? `${formatDate(b.checkIn)} → ${formatDate(b.checkOut)}` : plural(b.nights, 'night')} · {plural(b.guests, 'guest')}
                  </span>
                </span>
                <span className="a-list-side">
                  {b.conflict && <span className="badge badge-cancelled">Clash</span>}
                  <StatusBadge status={b.status} />
                  {show === 'upcoming' && <span className="muted">{formatDate(b.checkIn)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { data, error, loading, reload } = useAsync(() => get('/dashboard'), []);
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);

  if (error) return <p className="a-err">{error}</p>;
  if (loading && !data) return <p>Loading…</p>;
  const s = data.stats;
  const occ = s.activeRooms ? Math.round((s.occupied / s.activeRooms) * 100) : 0;

  return (
    <>
      <div className="a-page-head">
        <div>
          <h1>Good day</h1>
          <p className="muted">{formatDate(data.today)}</p>
        </div>
        <div className="a-head-actions">
          <button type="button" className="a-btn a-btn-primary" onClick={() => setCreating(true)}>
            + New booking
          </button>
        </div>
      </div>

      <div className="a-stats">
        <a className={`a-stat${s.pending ? ' a-stat-alert' : ''}`} href="#/bookings/pending">
          <span>Pending requests</span>
          <strong>{s.pending}</strong>
          <small>{s.pending ? 'Need a reply' : 'All answered'}</small>
        </a>
        <div className="a-stat">
          <span>Occupied tonight</span>
          <strong>
            {s.occupied}/{s.activeRooms}
          </strong>
          <small>{occ}% occupancy</small>
        </div>
        <div className="a-stat">
          <span>In house now</span>
          <strong>{s.inHouse}</strong>
          <small>checked-in guests</small>
        </div>
        <div className="a-stat">
          <span>This month booked</span>
          <strong>{kes(s.monthBooked)}</strong>
          <small>
            {plural(s.monthBookings, 'booking')} · {plural(s.monthNights, 'night')}
          </small>
        </div>
        <div className="a-stat">
          <span>This month collected</span>
          <strong>{kes(s.monthPaid)}</strong>
          <small>payments recorded</small>
        </div>
        <div className={`a-stat${s.outstanding ? ' a-stat-warn' : ''}`}>
          <span>Outstanding balances</span>
          <strong>{kes(s.outstanding)}</strong>
          <small>confirmed &amp; past stays</small>
        </div>
      </div>

      <div className="a-dash-grid">
        <List title="Arriving today" items={data.arrivals} empty="No arrivals today." onOpen={setOpen} />
        <List title="Leaving today" items={data.departures} empty="No departures today." onOpen={setOpen} />
        <List title="Pending requests" items={data.pending} empty="No requests waiting." onOpen={setOpen} show="created" />
        <List title="Next 7 days" items={data.upcoming} empty="Nothing booked in the next week." onOpen={setOpen} show="upcoming" />
      </div>

      {open && <BookingPanel id={open} onClose={() => setOpen(null)} onChanged={reload} />}
      {creating && <BookingPanel id={null} onClose={() => setCreating(false)} onChanged={reload} />}
    </>
  );
}
