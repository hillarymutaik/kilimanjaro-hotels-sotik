// Admin API client. Every call sends the session cookie and the CSRF header.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function adminApi(path, { method = 'GET', body, form } = {}) {
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
  const form = new FormData();
  form.append('file', file);
  const { url } = await adminApi('/upload', { method: 'POST', form });
  return url;
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
