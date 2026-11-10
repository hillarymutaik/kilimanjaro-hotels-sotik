// Finishes the GitHub Pages build (run after `vite build` with VITE_STATIC=1):
// writes dist/site.json from the seed content, copies the photos, and adds
// 404.html so links like /rooms work when opened directly.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEED_IMAGES, SEED_ROOMS, SEED_SETTINGS } from '../server/seed-data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const base = process.env.BASE_PATH || '/';
const img = (p) => (p?.startsWith('/uploads/') ? base + p.slice(1) : p);

const s = SEED_SETTINGS;
const site = {
  ...s,
  images: { hero: img(s.images.hero), about: img(s.images.about) },
  gallery: s.gallery.map((g) => ({ ...g, src: img(g.src) })),
  comingSoon: s.comingSoon?.enabled ? s.comingSoon : null,
  rooms: SEED_ROOMS.map((r, i) => ({
    id: i + 1,
    name: r.name,
    price: r.price,
    maxGuests: r.max_guests,
    description: r.description,
    features: r.features,
    image: img(r.image),
    active: true,
    sortOrder: i,
  })),
};

writeFileSync(join(dist, 'site.json'), JSON.stringify(site));
mkdirSync(join(dist, 'uploads'), { recursive: true });
for (const f of SEED_IMAGES) copyFileSync(join(root, 'server', 'seed-images', f), join(dist, 'uploads', f));
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
writeFileSync(join(dist, '.nojekyll'), '');

// The admin panel runs on the hotel PC; /admin/ on Pages forwards there when ADMIN_URL is set.
// Without it, /admin/ explains why instead of showing "Page not found".
// With Supabase the real admin panel is already built into dist/admin/.
const withSupabase = Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY);
const adminUrl = process.env.ADMIN_URL;
const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const adminBody = adminUrl
  ? `<script>location.replace(${JSON.stringify(adminUrl).replace(/</g, '\\u003c')})</script>
     <h1>Opening the admin panel…</h1>
     <p><a class="btn" href="${esc(adminUrl)}">Continue to the admin panel</a></p>`
  : `<h1>The admin panel isn't set up yet</h1>
     <p>This site is on GitHub Pages, which can't run a server. The admin panel keeps its logins, bookings,
       prices and photos in a free Supabase project, and that isn't connected yet.</p>
     <p>To turn it on, follow “GitHub Pages and Supabase” in the project README. When the
       <b>SUPABASE_URL</b> and <b>SUPABASE_ANON_KEY</b> repository variables are set, the next deploy
       puts the admin panel here.</p>
     <p><a class="btn" href="${base}">Back to the website</a></p>`;
if (!withSupabase) {
mkdirSync(join(dist, 'admin'), { recursive: true });
writeFileSync(
  join(dist, 'admin', 'index.html'),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Admin | Kilimanjaro Hotels</title><link rel="icon" href="${base}favicon.svg">
<style>
:root { --bg: #f7f5ef; --card: #fff; --ink: #1e2925; --mute: #5e6b65; --brand: #1f5246; --gold: #d6ad62; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg: #0e1d19; --card: #172f28; --ink: #eef2ee; --mute: #a7b7af; --brand: #e5c987; color-scheme: dark; } }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; box-sizing: border-box;
  background: var(--bg); color: var(--ink); font: 16px/1.6 system-ui, sans-serif; }
main { max-width: 520px; background: var(--card); border-radius: 16px; padding: 28px; box-shadow: 0 14px 34px -20px rgba(0,0,0,.35); }
h1 { font: 600 26px/1.25 Georgia, serif; color: var(--brand); margin: 0 0 12px; }
p { color: var(--mute); } b { color: var(--ink); word-break: break-all; }
.btn { display: inline-block; background: var(--gold); color: #17251f; font-weight: 700; padding: 11px 20px; border-radius: 10px; text-decoration: none; }
</style></head><body><main>${adminBody}</main></body></html>`
);
}
console.log(`Static site ready in dist/ (base ${base}, ${withSupabase ? 'Supabase: live data + admin' : `${site.rooms.length} rooms, no admin`})`);
