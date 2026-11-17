import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { POST } from '../app/api/measure/route.js';

const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = (server) => new Promise((resolve) => server.close(resolve));
const request = (value) =>
  new Request('http://localhost/api/measure', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });

test('API rejects malformed JSON and missing URL', async () => {
  const malformed = await POST(
    new Request('http://localhost/api/measure', { method: 'POST', body: '{' }),
  );
  assert.equal(malformed.status, 400);
  assert.match((await malformed.json()).error, /JSON/);
  const missing = await POST(request({}));
  assert.equal(missing.status, 400);
  assert.match((await missing.json()).error, /строкой/);
});

test('API streams starts, samples, and the final result in order', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('data');
  });
  const port = await listen(server);
  try {
    const response = await POST(request({ url: `http://127.0.0.1:${port}/file` }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/x-ndjson/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const events = (await response.text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.deepEqual(
      events.map((event) => event.type),
      Array.from({ length: 10 }, () => ['start', 'sample'])
        .flat()
        .concat('result'),
    );
    assert.equal(events.at(-1).result.totalBytes, 40);
    assert.equal(events.at(-1).result.samples.length, 10);
  } finally {
    await close(server);
  }
});

test('API returns an error event for invalid target URL', async () => {
  const response = await POST(request({ url: 'ftp://example.com/file' }));
  const events = (await response.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'error');
  assert.match(events[0].error, /HTTP/);
});
