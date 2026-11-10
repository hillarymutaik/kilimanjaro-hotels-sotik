/**
 * Photo paths: full URLs (Supabase Storage) and absolute paths (/uploads/… on the Node server)
 * are used as they are; "uploads/x.jpg" (photos shipped with the site) gets the site's base path,
 * so it also works under /<repo>/ on GitHub Pages.
 */
export function img(src) {
  if (!src) return '';
  if (/^(https?:|data:|blob:|\/)/.test(src)) return src;
  return import.meta.env.BASE_URL + src;
}
