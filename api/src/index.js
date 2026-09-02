/* Helix content API: a small Cloudflare Worker that lets staff log in with a
   username and password, edit the JSON collections, upload images, and publish
   everything as commits to the GitHub repository that GitHub Pages serves.

   Secrets / vars (wrangler secret put NAME):
     USERS           JSON array: [{"username":"martim","hash":"pbkdf2$...","name":"Martim Galésio"}]
                     Generate hashes with:  node hash-password.mjs <password>
     SESSION_SECRET  long random string, signs session tokens
     GITHUB_TOKEN    fine-grained token with Contents: read and write on the repo
   Vars (wrangler.toml):
     GITHUB_REPO     "SaimaJope/helix"
     GITHUB_BRANCH   "main"
     ALLOWED_ORIGINS comma separated list of site origins allowed to call the API
*/

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const b64url = (buf) => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const utf8ToB64 = (str) => b64(enc.encode(str));

const CONTENT_FILES = ['projects', 'publications', 'initiatives', 'news', 'events', 'products', 'opportunities', 'team', 'settings'];
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'application/pdf': 'pdf' };
const MAX_UPLOAD = 8 * 1024 * 1024;

/* ------------------------------------------------------------ passwords */
async function pbkdf2(password, salt, iterations = 120000) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 120000;
  const dk = await pbkdf2(password, salt, iterations);
  return `pbkdf2$${iterations}$${b64url(salt)}$${b64url(dk)}`;
}
async function verifyPassword(password, stored) {
  try {
    const [algo, iter, salt, hash] = stored.split('$');
    if (algo !== 'pbkdf2') return false;
    const dk = await pbkdf2(password, fromB64url(salt), parseInt(iter, 10));
    const want = fromB64url(hash);
    if (dk.length !== want.length) return false;
    let diff = 0;
    for (let i = 0; i < dk.length; i++) diff |= dk[i] ^ want[i];
    return diff === 0;
  } catch (e) { return false; }
}

/* -------------------------------------------------------------- sessions */
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
async function makeToken(env, username) {
  const exp = Date.now() + 12 * 3600 * 1000;
  const payload = b64url(enc.encode(JSON.stringify({ u: username, exp })));
  return payload + '.' + await hmac(env.SESSION_SECRET, payload);
}
async function readToken(env, req) {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  if (await hmac(env.SESSION_SECRET, payload) !== sig) return null;
  const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  if (!data.exp || data.exp < Date.now()) return null;
  const user = users(env).find((x) => x.username === data.u);
  return user ? { username: user.username, name: user.name || user.username } : null;
}
function users(env) {
  try { return JSON.parse(env.USERS || '[]'); } catch (e) { return []; }
}

/* ---------------------------------------------------------------- github */
async function gh(env, path, init = {}) {
  const res = await fetch('https://api.github.com' + path, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + env.GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'helix-content-api',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {})
    }
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${(json && json.message) || text.slice(0, 200)}`);
  return json;
}
async function getFile(env, path) {
  try {
    const j = await gh(env, `/repos/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH}`);
    const content = new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
    return { sha: j.sha, content };
  } catch (e) {
    if (String(e.message).includes('404')) return { sha: null, content: null };
    throw e;
  }
}
async function putFile(env, path, contentB64, message, sha) {
  const body = { message, content: contentB64, branch: env.GITHUB_BRANCH };
  if (sha) body.sha = sha;
  return gh(env, `/repos/${env.GITHUB_REPO}/contents/${path}`, { method: 'PUT', body: JSON.stringify(body) });
}

/* --------------------------------------------------------------- helpers */
function cors(env, req) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin) || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const slug = (s) => String(s || 'file').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'file';

/* ------------------------------------------------------------------ app */
export default {
  async fetch(req, env) {
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/' || path === '/health') return json({ ok: true, service: 'helix-content-api', repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH }, 200, h);

      if (path === '/login' && req.method === 'POST') {
        const { username, password } = await req.json().catch(() => ({}));
        const user = users(env).find((x) => x.username === String(username || '').trim().toLowerCase());
        const ok = user && await verifyPassword(String(password || ''), user.hash);
        if (!ok) { await new Promise((r) => setTimeout(r, 600)); return json({ error: 'Wrong username or password.' }, 401, h); }
        return json({ token: await makeToken(env, user.username), user: { username: user.username, name: user.name || user.username } }, 200, h);
      }

      const me = await readToken(env, req);
      if (!me) return json({ error: 'Please log in.' }, 401, h);

      if (path === '/me') return json({ user: me }, 200, h);

      const m = path.match(/^\/content\/([a-z]+)$/);
      if (m) {
        const name = m[1];
        if (!CONTENT_FILES.includes(name)) return json({ error: 'Unknown collection.' }, 404, h);
        const file = `content/${name}.json`;
        if (req.method === 'GET') {
          const { sha, content } = await getFile(env, file);
          return json({ name, sha, data: content ? JSON.parse(content) : (name === 'settings' ? {} : []) }, 200, h);
        }
        if (req.method === 'PUT') {
          const body = await req.json().catch(() => null);
          if (!body || !('data' in body)) return json({ error: 'Missing data.' }, 400, h);
          if (name !== 'settings' && !Array.isArray(body.data)) return json({ error: 'Collection must be an array.' }, 400, h);
          const { sha } = await getFile(env, file);
          if (body.sha && sha && body.sha !== sha) return json({ error: 'Someone else published this collection since you loaded it. Reload and try again.' }, 409, h);
          const text = JSON.stringify(body.data, null, 2) + '\n';
          const r = await putFile(env, file, utf8ToB64(text), `content: update ${name} (${me.name})`, sha);
          return json({ ok: true, sha: r.content.sha, commit: r.commit.sha, url: r.commit.html_url }, 200, h);
        }
      }

      if (path === '/upload' && req.method === 'POST') {
        const form = await req.formData();
        const file = form.get('file');
        if (!file || typeof file === 'string') return json({ error: 'No file.' }, 400, h);
        const ext = IMAGE_TYPES[file.type];
        if (!ext) return json({ error: 'Only JPG, PNG, WebP, GIF, SVG or PDF files.' }, 415, h);
        if (file.size > MAX_UPLOAD) return json({ error: 'File is larger than 8 MB.' }, 413, h);
        const d = new Date();
        const base = slug((form.get('name') || file.name || 'upload').replace(/\.[a-z0-9]+$/i, ''));
        const rel = `uploads/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${base}-${Date.now().toString(36)}.${ext}`;
        const buf = await file.arrayBuffer();
        let bin = ''; const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        await putFile(env, rel, btoa(bin), `upload: ${rel} (${me.name})`, null);
        return json({ ok: true, path: rel }, 200, h);
      }

      if (path === '/status') {
        const commits = await gh(env, `/repos/${env.GITHUB_REPO}/commits?sha=${env.GITHUB_BRANCH}&per_page=5`);
        let pages = null;
        try { pages = await gh(env, `/repos/${env.GITHUB_REPO}/pages/builds/latest`); } catch (e) {}
        return json({ commits: commits.map((c) => ({ sha: c.sha.slice(0, 7), message: c.commit.message, date: c.commit.author.date })), pages: pages && { status: pages.status, updated: pages.updated_at } }, 200, h);
      }

      return json({ error: 'Not found.' }, 404, h);
    } catch (e) {
      return json({ error: String(e.message || e) }, 500, h);
    }
  }
};
