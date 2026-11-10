import { useEffect, useState } from 'react';
import { formatDate, kes } from '../../lib/format.js';
import { downloadBookingsCsv, get, SOURCE_LABEL, STATUS_LABEL } from '../api.js';
import BookingPanel from '../BookingPanel.jsx';
import { useAdmin } from '../context.js';
import { Empty, StatusBadge, useAsync } from '../ui.jsx';

const FILTERS = [['active', 'Active'], ['pending', 'Pending'], ['confirmed', 'Confirmed'], ['checked_in', 'Checked in'], ['checked_out', 'Checked out'], ['cancelled', 'Cancelled'], ['all', 'All']];

export default function Bookings({ param }) {
  const { notify } = useAdmin();
  const [status, setStatus] = useState(STATUS_LABEL[param] ? param : 'active');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (STATUS_LABEL[param]) setStatus(param);
  }, [param]);
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams({ status, ...(query ? { q: query } : {}) });
  const { data, error, loading, reload } = useAsync(() => get(`/bookings?${params}`), [status, query]);

  return (
    <>
      <div className="a-page-head">
        <h1>Bookings</h1>
        <div className="a-head-actions">
          <button type="button" className="a-btn" onClick={() => downloadBookingsCsv().catch((e) => notify(e.message, 'error'))}>Export CSV</button>
          <button type="button" className="a-btn a-btn-primary" onClick={() => setCreating(true)}>
            + New booking
          </button>
        </div>
      </div>

      <div className="a-toolbar">
        <div className="a-tabs" role="tablist" aria-label="Filter by status">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={status === k} className={status === k ? 'is-active' : ''} onClick={() => setStatus(k)}>
              {label}
            </button>
          ))}
        </div>
        <input className="a-search" type="search" placeholder="Search name, phone or reference…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search bookings" />
      </div>

      {error && <p className="a-err">{error}</p>}
      {loading && !data ? (
        <p>Loading…</p>
      ) : data?.length === 0 ? (
        <Empty>No bookings match.</Empty>
      ) : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Room</th>
                <th>Stay</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Via</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((b) => (
                <tr key={b.id} onClick={() => setOpen(b.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(b.id)}>
                  <td>
                    <strong>{b.name}</strong>
                    <span className="muted block">{b.ref} · {b.phone}</span>
                  </td>
                  <td>{b.roomName}</td>
                  <td>
                    {formatDate(b.checkIn)}
                    <span className="muted block">→ {formatDate(b.checkOut)} · {b.nights}n</span>
                  </td>
                  <td>{kes(b.total)}</td>
                  <td className={b.balance > 0 && !['cancelled', 'no_show'].includes(b.status) ? 'owing' : ''}>{kes(b.balance)}</td>
                  <td>
                    <StatusBadge status={b.status} />
                    {b.conflict && <span className="badge badge-cancelled" title="Overlaps a confirmed booking or blocked dates">Clash</span>}
                  </td>
                  <td className="muted">{SOURCE_LABEL[b.source]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <BookingPanel id={open} onClose={() => setOpen(null)} onChanged={reload} />}
      {creating && <BookingPanel id={null} onClose={() => setCreating(false)} onChanged={reload} />}
    </>
  );
}
