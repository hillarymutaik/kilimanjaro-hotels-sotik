import { addDays, todayISO } from '../lib/format.js';
import Icon from './Icon.jsx';

export default function SearchBar({ stay, onChange, onSubmit, error }) {
  const today = todayISO();

  const setCheckIn = (v) => {
    const next = { ...stay, checkIn: v };
    if (v && (!stay.checkOut || stay.checkOut <= v)) next.checkOut = addDays(v, 1);
    onChange(next);
  };

  return (
    <div className="wrap">
      <form
        className="search"
        id="book"
        aria-label="Check availability"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="field">
          <label htmlFor="ci">
            <Icon name="calendar" size={15} /> Check-in
          </label>
          <input id="ci" type="date" min={today} value={stay.checkIn} required onChange={(e) => setCheckIn(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="co">
            <Icon name="calendar" size={15} /> Check-out
          </label>
          <input
            id="co"
            type="date"
            min={stay.checkIn ? addDays(stay.checkIn, 1) : today}
            value={stay.checkOut}
            required
            onChange={(e) => onChange({ ...stay, checkOut: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="gu">
            <Icon name="users" size={15} /> Guests
          </label>
          <select id="gu" value={stay.guests} onChange={(e) => onChange({ ...stay, guests: +e.target.value })}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'guest' : 'guests'}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary search-btn">
          Check availability <Icon name="arrow" size={18} />
        </button>
      </form>
      <p className="err search-err" role="alert">
        {error}
      </p>
    </div>
  );
}
