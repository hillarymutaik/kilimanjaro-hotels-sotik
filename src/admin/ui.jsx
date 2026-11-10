// Small shared admin UI pieces.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../components/Icon.jsx';
import { STATUS_LABEL, uploadImage } from './api.js';
import { img } from '../lib/img.js';

/** Round avatar with the user's initials (from an email or username). */
export function Avatar({ name = '', small = false }) {
  const base = String(name).split('@')[0];
  const parts = base.split(/[._\-\s]+/).filter(Boolean);
  const initials = (parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2)).toUpperCase();
  return (
    <span className={`a-avatar${small ? ' a-avatar-sm' : ''}`} aria-hidden="true">
      {initials || 'A'}
    </span>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="a-loading" role="status">
      <span className="a-spinner" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

export function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, toast.type === 'error' ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [toast, onDone]);
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type || 'ok'}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <Icon name={toast.type === 'error' ? 'close' : 'check'} size={18} />
      <span>{toast.message}</span>
    </div>
  );
}

/** Slide-over panel / modal with Escape to close and scroll lock. */
export function Panel({ title, onClose, children, wide = false, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  // Portal to <body> so the panel can be printed on its own.
  return createPortal(
    <div className="panel-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className={`panel${wide ? ' panel-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="panel-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="panel-body">{children}</div>
        {footer && <footer className="panel-foot">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
}

export function Field({ label, children, hint, full }) {
  return (
    <label className={`a-field${full ? ' full' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    fn()
      .then((data) => alive && setState({ loading: false, data, error: '' }))
      .catch((e) => alive && setState({ loading: false, data: null, error: e.message }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

/** Page title with an optional subtitle and actions on the right. */
export function PageHead({ title, subtitle, children }) {
  return (
    <div className="a-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="a-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="a-head-actions">{children}</div>}
    </div>
  );
}

export function ImagePicker({ value, onChange, onError, label = 'Photo' }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      onChange(await uploadImage(f));
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="img-picker">
      {value ? <img src={img(value)} alt="" /> : <div className="img-empty">No photo</div>}
      <div>
        <button type="button" className="a-btn" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? 'Uploading…' : value ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
        </button>
        <small>JPG, PNG or WebP, up to 5 MB.</small>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />
      </div>
    </div>
  );
}
