// Local test server: runs the Worker's fetch handler under Node (22+) without wrangler.
// Usage: node dev-server.mjs [port]   (reads env from .dev.vars)
import http from 'node:http';
import fs from 'node:fs';
import worker from './src/index.js';

const port = parseInt(process.argv[2] || '8787', 10);
const env = {};
try {
  for (const line of fs.readFileSync(new URL('./.dev.vars', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
  }
} catch (e) {}
try {
  const toml = fs.readFileSync(new URL('./wrangler.toml', import.meta.url), 'utf8');
  for (const m of toml.matchAll(/^([A-Z_]+)\s*=\s*"([^"]*)"/gm)) env[m[1]] = env[m[1]] ?? m[2];
} catch (e) {}

http.createServer(async (req, res) => {
  const t0 = Date.now(); console.error('IN', req.method, req.url, 'len=' + (req.headers['content-length'] || '-'), 'origin=' + (req.headers.origin || '-'), 'acrm=' + (req.headers['access-control-request-method'] || '-'));
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks); console.error('BODY', req.method, req.url, body.length, (Date.now() - t0) + 'ms');
  const url = `http://${req.headers.host}${req.url}`;
  const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
  try {
    const r = await worker.fetch(request, env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer())); console.error('OUT', req.method, req.url, r.status, (Date.now() - t0) + 'ms');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: String(e) }));
  }
}).listen(port, '127.0.0.1', () => console.log('helix-content-api (node shim) on http://127.0.0.1:' + port));
