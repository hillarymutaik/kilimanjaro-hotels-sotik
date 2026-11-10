import { useMemo, useState } from 'react';
import { addDays, formatDate, parseISODate, todayISO } from '../../lib/format.js';
import { del, get, post } from '../api.js';
import BookingPanel from '../BookingPanel.jsx';
import { SITE_HOME, useAdmin } from '../context.js';
import { Empty, Field, Panel, useAsync } from '../ui.jsx';
import Icon from '../../components/Icon.jsx';

const DAYS = 14;

export default function Calendar() {
  const { notify } = useAdmin();
  const [from, setFrom] = useState(todayISO());
  const { data, error, reload } = useAsync(() => get(`/calendar?from=${from}&days=${DAYS}`), [from]);
  const blocks = useAsync(() => get('/blocks'), []);
  const [open, setOpen] = useState(null);
  const [cell, setCell] = useState(null); // { room, date }
  const [newBooking, setNewBooking] = useState(null);
  const [blockForm, setBlockForm] = useState({ roomId: '', startDate: todayISO(), endDate: addDays(todayISO(), 1), reason: '' });
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(from, i)), [from]);
  const today = todayISO();
  const refreshAll = () => (reload(), blocks.reload());

  const addBlock = async (body) => {
    setBusy(true);
    try {
      await post('/blocks', body);
      notify('Dates blocked.');
      setCell(null);
      refreshAll();
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const removeBlock = async (id) => {
    try {
      await del(`/blocks/${id}`);
      notify('Block removed.');
      refreshAll();
    } catch (e) {
      notify(e.message, 'error');
    }
  };

  return (
    <>
      <div className="a-page-head">
        <div>
          <h1>Availability</h1>
          <p className="a-subtitle">Two weeks for every room. Click a free day to book or block it.</p>
        </div>
        <div className="a-head-actions">
          <a className="a-btn" href={SITE_HOME + 'reception'} target="_blank" rel="noopener" title="Rooms available tonight, for a screen at the front desk">
            <Icon name="monitor" size={16} /> Reception screen
          </a>
          <a className="a-btn" href={SITE_HOME + 'screens'} target="_blank" rel="noopener" title="Looping slideshow for TVs around the hotel">
            <Icon name="image" size={16} /> Hotel screens
          </a>
          <button type="button" className="a-btn" onClick={() => setFrom(addDays(from, -DAYS))} aria-label="Previous two weeks">
            <Icon name="left" size={18} />
          </button>
          <button type="button" className="a-btn" onClick={() => setFrom(todayISO())}>
            Today
          </button>
          <button type="button" className="a-btn" onClick={() => setFrom(addDays(from, DAYS))} aria-label="Next two weeks">
            <Icon name="right" size={18} />
          </button>
          <input type="date" className="a-date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} aria-label="Start date" />
        </div>
      </div>
      <p className="muted a-legend">
        <span className="lg lg-pending" /> Pending <span className="lg lg-confirmed" /> Confirmed <span className="lg lg-checked_in" /> Checked in
        <span className="lg lg-block" /> Blocked · Click an empty day to add a booking or block it.
      </p>

      {error && <p className="a-err">{error}</p>}
      {data && (
        <div className="a-table-wrap">
          <table className="cal">
            <thead>
              <tr>
                <th className="cal-room">Room</th>
                {days.map((d) => {
                  const dt = parseISODate(d);
                  return (
                    <th key={d} className={d === today ? 'is-today' : dt.getDay() === 0 || dt.getDay() === 6 ? 'is-weekend' : ''}>
                      <span>{dt.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                      <strong>{dt.getDate()}</strong>
                      <span>{dt.toLocaleDateString('en-GB', { month: 'short' })}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.rooms.map((r) => (
                <tr key={r.id}>
                  <th className="cal-room">
                    {r.name}
                    {!r.active && <small className="muted block">hidden</small>}
                  </th>
                  {days.map((d) => {
                    const b = data.bookings.find((x) => x.roomId === r.id && x.checkIn <= d && x.checkOut > d);
                    const bl = !b && data.blocks.find((x) => x.room_id === r.id && x.start_date <= d && x.end_date > d);
                    if (b) {
                      const first = b.checkIn === d || d === from;
                      return (
                        <td key={d} className={`cal-cell cal-${b.status}${first ? ' is-first' : ''}`}>
                          <button type="button" onClick={() => setOpen(b.id)} title={`${b.name} · ${b.ref}`}>
                            {first ? b.name.split(' ')[0] : ''}
                          </button>
                        </td>
                      );
                    }
                    if (bl) {
                      return (
                        <td key={d} className="cal-cell cal-block" title={bl.reason || 'Blocked'}>
                          <span>{bl.start_date === d || d === from ? bl.reason || 'Blocked' : ''}</span>
                        </td>
                      );
                    }
                    return (
                      <td key={d} className="cal-cell cal-free">
                        <button type="button" aria-label={`${r.name}, ${formatDate(d)}: free`} onClick={() => setCell({ room: r, date: d })} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="a-two">
        <section className="a-card">
          <h2>Block dates</h2>
          <p className="muted">For maintenance, repairs or rooms sold offline. Guests can’t book a room on blocked dates.</p>
          <form
            className="a-form"
            onSubmit={(e) => {
              e.preventDefault();
              addBlock({ ...blockForm, roomId: Number(blockForm.roomId) });
            }}
          >
            <Field label="Room" full>
              <select value={blockForm.roomId} onChange={(e) => setBlockForm({ ...blockForm, roomId: e.target.value })} required>
                <option value="">Choose a room…</option>
                {data?.rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </Field>
            <Field label="From">
              <input type="date" value={blockForm.startDate} onChange={(e) => setBlockForm({ ...blockForm, startDate: e.target.value })} required />
            </Field>
            <Field label="Until (room free again on)">
              <input type="date" value={blockForm.endDate} onChange={(e) => setBlockForm({ ...blockForm, endDate: e.target.value })} required />
            </Field>
            <Field label="Reason (optional)" full>
              <input value={blockForm.reason} placeholder="e.g. Painting" onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} />
            </Field>
            <div className="full">
              <button className="a-btn a-btn-primary" disabled={busy}>Block dates</button>
            </div>
          </form>
        </section>
        <section className="a-card">
          <h2>Current &amp; upcoming blocks</h2>
          {blocks.data?.length ? (
            <ul className="a-list">
              {blocks.data.map((b) => (
                <li key={b.id} className="a-list-row">
                  <span className="a-list-main">
                    <strong>{b.room_name}</strong>
                    <span className="muted">
                      {formatDate(b.start_date)} → {formatDate(b.end_date)}{b.reason ? ` · ${b.reason}` : ''}
                    </span>
                  </span>
                  <button type="button" className="a-btn a-btn-ghost" onClick={() => removeBlock(b.id)}>Remove</button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No blocked dates.</Empty>
          )}
        </section>
      </div>

      {cell && (
        <Panel title={`${cell.room.name} · ${formatDate(cell.date)}`} onClose={() => setCell(null)}>
          <p className="muted">This room is free on this date.</p>
          <div className="bk-actions">
            <button
              type="button"
              className="a-btn a-btn-primary"
              onClick={() => {
                setNewBooking({ roomId: cell.room.id, checkIn: cell.date, checkOut: addDays(cell.date, 1), guests: 1 });
                setCell(null);
              }}
            >
              New booking
            </button>
            <button type="button" className="a-btn" disabled={busy} onClick={() => addBlock({ roomId: cell.room.id, startDate: cell.date, endDate: addDays(cell.date, 1), reason: '' })}>
              Block this night
            </button>
          </div>
        </Panel>
      )}
      {open && <BookingPanel id={open} onClose={() => setOpen(null)} onChanged={refreshAll} />}
      {newBooking && <BookingPanel id={null} initial={newBooking} onClose={() => setNewBooking(null)} onChanged={refreshAll} />}
    </>
  );
}
