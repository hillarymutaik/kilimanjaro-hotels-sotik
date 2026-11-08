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
console.log(`Static site ready in dist/ (base ${base}, ${site.rooms.length} rooms)`);
