// Admin API client. With Supabase configured, calls go to supabase-api.js; otherwise to the
// Node server, sending the session cookie and the CSRF header.
import { SUPABASE } from '../lib/supabase.js';
import { bookingsCsv, supabaseAdminApi, uploadPhoto } from './supabase-api.js';

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function adminApi(path, { method = 'GET', body, form } = {}) {
  if (SUPABASE) {
    try {
      return await supabaseAdminApi(path, { method, body });
    } catch (e) {
      if (e.status === 401 && path !== '/login') onUnauthorized();
      throw e;
    }
  }
  const headers = { 'X-Requested-With': 'khs-admin' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch('/api/admin' + path, {
    method,
    headers,
    credentials: 'same-origin',
    body: form || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== '/login') onUnauthorized();
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status}).`);
  return data;
}

export const get = (p) => adminApi(p);
export const post = (p, body) => adminApi(p, { method: 'POST', body: body ?? {} });
export const put = (p, body) => adminApi(p, { method: 'PUT', body });
export const patch = (p, body) => adminApi(p, { method: 'PATCH', body });
export const del = (p) => adminApi(p, { method: 'DELETE' });

export async function uploadImage(file) {
  if (SUPABASE) return uploadPhoto(file);
  const form = new FormData();
  form.append('file', file);
  const { url } = await adminApi('/upload', { method: 'POST', form });
  return url;
}

/** Downloads every booking as a spreadsheet (CSV). */
export async function downloadBookingsCsv() {
  if (!SUPABASE) {
    location.href = '/api/admin/bookings.csv';
    return;
  }
  const blob = new Blob([await bookingsCsv()], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};
export const SOURCE_LABEL = { website: 'Website', walk_in: 'Walk-in', phone: 'Phone', whatsapp: 'WhatsApp', other: 'Other' };
