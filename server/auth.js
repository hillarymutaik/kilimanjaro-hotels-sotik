import crypto from 'node:crypto';

const COOKIE = 'khs_admin';
const SESSION_DAYS = 7;

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function createSession(db, res, adminId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = Date.now() + SESSION_DAYS * 86400000;
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)').run(sha(token), adminId, expires);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}`
  );
}

export function destroySession(db, req, res) {
  const t = readCookie(req, COOKIE);
  if (t) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(t));
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

/** Express middleware: requires a valid admin session; sets req.admin. */
export function requireAdmin(db) {
  return (req, res, next) => {
    const t = readCookie(req, COOKIE);
    const row = t
      ? db
          .prepare(
            'SELECT a.id, a.username FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ? AND s.expires_at > ?'
          )
          .get(sha(t), Date.now())
      : null;
    if (!row) return res.status(401).json({ error: 'Please log in.' });
    // CSRF guard: state-changing requests must carry a custom header,
    // which a cross-site form or image can't set.
    if (req.method !== 'GET' && req.get('x-requested-with') !== 'khs-admin') {
      return res.status(403).json({ error: 'Missing request header.' });
    }
    req.admin = row;
    next();
  };
}
