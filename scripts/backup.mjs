// Daily backup: a consistent copy of the database (safe while the server runs)
// plus the uploaded photos. Keeps the last 30 days.
//   node --env-file-if-exists=.env scripts/backup.mjs [backup folder]
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(root, process.env.DATA_DIR || 'data');
const outDir = path.resolve(process.argv[2] || process.env.BACKUP_DIR || path.join(dataDir, '..', 'backups'));
const KEEP = 30;

const day = new Date().toISOString().slice(0, 10);
const target = path.join(outDir, day);
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'hotel.db'), { readOnly: true });
db.exec(`VACUUM INTO '${path.join(target, 'hotel.db').replaceAll("'", "''")}'`);
db.close();

const uploads = path.join(dataDir, 'uploads');
if (fs.existsSync(uploads)) fs.cpSync(uploads, path.join(target, 'uploads'), { recursive: true });

const old = fs
  .readdirSync(outDir)
  .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  .sort()
  .slice(0, -KEEP);
for (const d of old) fs.rmSync(path.join(outDir, d), { recursive: true, force: true });

console.log(`Backup written to ${target}`);
