import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR, UPLOAD_DIR } from './db.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';
import { HttpError } from './util.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, '..', 'dist');
const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.disable('x-powered-by');
// Behind Render/Railway/nginx, trust the first proxy so req.ip is the real client.
if (process.env.TRUST_PROXY !== '0') app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Only accept JSON bodies on the API (multipart uploads are handled by multer).
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json') && !req.is('multipart/form-data')) {
    return res.status(415).json({ error: 'Send JSON.' });
  }
  next();
});
app.use('/api', express.json({ limit: '200kb' }));
app.use('/api', publicRouter);
app.use('/api/admin', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
}, adminRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: false }));

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: 'index.html' }));
  app.get('/admin', (req, res) => res.redirect(301, '/admin/'));
}

// Error handler: HttpError → its status; anything else → 500 without leaking details.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`Kilimanjaro Hotels server on http://localhost:${PORT}  (data: ${DATA_DIR})`);
});
