import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { measure, summarize, validateUrl } from '../src/measure.js';

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));

test('URL validation accepts HTTP(S) and rejects invalid protocols and credentials', () => {
  assert.equal(validateUrl('https://example.com/a').hostname, 'example.com');
  assert.throws(() => validateUrl('ftp://example.com'), /HTTP/);
  assert.throws(() => validateUrl('https://user:pass@example.com'), /учётными/);
  assert.throws(() => validateUrl('oops'), /корректный URL/);
});

test('summary uses all downloaded bytes and total request time', () => {
  assert.deepEqual(summarize([{ bytes: 1_000_000, durationMs: 1000 }, { bytes: 1_000_000, durationMs: 1000 }]), {
    count: 2, totalBytes: 2_000_000, averageMs: 1000, megabitsPerSecond: 8,
    samples: [{ bytes: 1_000_000, durationMs: 1000 }, { bytes: 1_000_000, durationMs: 1000 }],
  });
});

test('integration: ten requests finish in sequence and count streamed response bodies', async () => {
  let active = 0; let peak = 0; let calls = 0; const urls = [];
  const server = createServer(async (req, res) => {
    active++; peak = Math.max(peak, active); calls++; urls.push(req.url);
    res.writeHead(200, { 'content-type': 'application/octet-stream' });
    res.write(Buffer.alloc(1024));
    await new Promise(resolve => setTimeout(resolve, 5));
    res.end(Buffer.alloc(2048), () => { active--; });
  });
  const port = await listen(server);
  try {
    const progress = [];
    const result = await measure(`http://127.0.0.1:${port}/file`, { onSample: item => progress.push(item.number) });
    assert.equal(calls, 10); assert.equal(peak, 1); assert.equal(result.totalBytes, 30_720);
    assert.deepEqual(progress, [1,2,3,4,5,6,7,8,9,10]);
    assert.equal(new Set(urls).size, 10);
    assert.ok(result.averageMs > 0); assert.ok(result.megabitsPerSecond > 0);
  } finally { await close(server); }
});

test('integration: non-success response stops measurement', async () => {
  const server = createServer((_req, res) => { res.writeHead(503); res.end('down'); });
  const port = await listen(server);
  try { await assert.rejects(measure(`http://127.0.0.1:${port}/file`), /HTTP 503/); }
  finally { await close(server); }
});
