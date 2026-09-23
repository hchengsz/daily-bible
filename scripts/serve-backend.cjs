/* global __dirname */
const http = require('node:http');
const path = require('node:path');
const { createRequestHandler } = require('expo-server/adapter/http');
const handler = createRequestHandler({ build: path.resolve(__dirname, '../dist/server') });
const allowed = new Set(['/api/translate', '/api/ai-translate', '/api/vocabulary']);
let windowStart = Date.now();
let requests = 0;
let active = 0;
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const fail = (status, error) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error }));
  };
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/healthz' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', app: 'daily-bible' }));
    return;
  }
  if (!allowed.has(pathname)) return fail(404, 'Not found.');
  if (req.method !== 'POST') return fail(405, 'POST required.');
  if (!req.headers['content-type']?.startsWith('application/json')) return fail(415, 'JSON required.');
  if (Number(req.headers['content-length']) > 200000) return fail(413, 'Request too large.');
  if (Date.now() - windowStart >= 3600000) { windowStart = Date.now(); requests = 0; }
  // Small shared beta service: bound upstream concurrency and hourly traffic.
  if (active >= 3 || requests >= 120) {
    res.setHeader('Retry-After', '60');
    return fail(429, 'AI service is busy. Please try again later.');
  }
  requests++;
  active++;
  try {
    await handler(req, res, () => {
      if (!res.headersSent) fail(500, 'Service temporarily unavailable.');
      else res.end();
    });
  } catch {
    if (!res.headersSent) fail(500, 'Service temporarily unavailable.');
    else res.end();
  } finally { active--; }
});
server.requestTimeout = 120000;
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
