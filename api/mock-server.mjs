// Local test double for admin/: runs the real Worker under Node against a fake GitHub API.
// The repo is in memory, seeded from ../content, so nothing is ever committed.
// Usage:  node mock-server.mjs [port]      then serve the site on http://127.0.0.1:5500
// Accounts: topgun / seraphim, bootstrap password 1234 (first login asks for a new one).
// Writes are logged to mock-writes.jsonl next to this file. Restart to reset all state.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import worker, { hashPassword } from './src/index.js';

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const port = parseInt(process.argv[2] || '8787', 10);
const LOG = new URL('./mock-writes.jsonl', import.meta.url);
fs.writeFileSync(LOG, '');
const repo = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'content'))) repo.set('content/' + f, fs.readFileSync(path.join(ROOT, 'content', f), 'utf8'));
const shaOf = (s) => 'sha' + Buffer.from(s).length.toString(36) + Math.random().toString(36).slice(2, 8);
const shas = new Map(); for (const [k, v] of repo) shas.set(k, shaOf(v));
const commits = [];

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  if (u.hostname !== 'api.github.com') return realFetch(url, init);
  const m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/);
  const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  if (m) {
    const p = decodeURIComponent(m[1]);
    if ((init.method || 'GET') === 'GET') {
      if (!repo.has(p)) return j({ message: 'Not Found' }, 404);
      return j({ sha: shas.get(p), content: Buffer.from(repo.get(p), 'utf8').toString('base64') });
    }
    const body = JSON.parse(init.body);
    if (repo.has(p) && body.sha !== shas.get(p)) return j({ message: 'sha mismatch' }, 409);
    const text = Buffer.from(body.content, 'base64');
    repo.set(p, text.toString('latin1')); const sha = shaOf(text); shas.set(p, sha);
    const csha = Math.random().toString(16).slice(2, 42).padEnd(40, '0');
    commits.unshift({ sha: csha, commit: { message: body.message, author: { date: new Date().toISOString() } } });
    fs.appendFileSync(LOG, JSON.stringify({ path: p, message: body.message, bytes: text.length, text: p.startsWith('content/') ? text.toString('utf8') : undefined }) + '\n');
    return j({ content: { sha }, commit: { sha: csha, html_url: 'https://github.com/x/y/commit/' + csha } });
  }
  if (u.pathname.match(/\/commits$/)) return j(commits.slice(0, 5));
  if (u.pathname.match(/\/pages\/builds\/latest$/)) return j({ status: 'built', updated_at: new Date().toISOString() });
  return j({ message: 'mock: unhandled ' + u.pathname }, 500);
};

const env = { GITHUB_REPO: 'SaimaJope/helix', GITHUB_BRANCH: 'main', ALLOWED_ORIGINS: 'http://127.0.0.1:5500', SESSION_SECRET: 'test-secret', GITHUB_TOKEN: 'fake' };
env.USERS = JSON.stringify([
  { username: 'topgun', name: 'TopGun', hash: await hashPassword('1234') },
  { username: 'seraphim', name: 'Seraphim', hash: await hashPassword('1234') }
]);
const kv = new Map();
env.AUTH_KV = { async get(k, t) { const v = kv.get(k); return v == null ? null : (t === 'json' ? JSON.parse(v) : v); }, async put(k, v) { kv.set(k, String(v)); }, async delete(k) { kv.delete(k); } };

http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
  console.log(req.method, req.url);
  try { const r = await worker.fetch(request, env); const buf = Buffer.from(await r.arrayBuffer());res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(buf); }
  catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: String(e) })); }
}).listen(port, '127.0.0.1', () => console.log('mock api on ' + port));
