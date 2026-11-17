import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { measure, summarize, validateUrl } from '../src/measure.js';

const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = (server) => new Promise((resolve) => server.close(resolve));

test('URL validation accepts HTTP(S) and rejects invalid protocols and credentials', () => {
  assert.equal(validateUrl('https://example.com/a').hostname, 'example.com');
  assert.throws(() => validateUrl('ftp://example.com'), /HTTP/);
  assert.throws(() => validateUrl('https://user:pass@example.com'), /учётными/);
  assert.throws(() => validateUrl('oops'), /корректный URL/);
});

test('summary uses all downloaded bytes and total request time', () => {
  assert.deepEqual(
    summarize([
      { bytes: 1_000_000, durationMs: 1000 },
      { bytes: 1_000_000, durationMs: 1000 },
    ]),
    {
      count: 2,
      totalBytes: 2_000_000,
      averageMs: 1000,
      megabitsPerSecond: 8,
      samples: [
        { bytes: 1_000_000, durationMs: 1000 },
        { bytes: 1_000_000, durationMs: 1000 },
      ],
    },
  );
});

test('integration: ten requests finish in sequence and count streamed response bodies', async () => {
  let active = 0;
  let peak = 0;
  let calls = 0;
  const urls = [];
  const server = createServer(async (req, res) => {
    active++;
    peak = Math.max(peak, active);
    calls++;
    urls.push(req.url);
    res.writeHead(200, { 'content-type': 'application/octet-stream' });
    res.write(Buffer.alloc(1024));
    await new Promise((resolve) => setTimeout(resolve, 5));
    res.end(Buffer.alloc(2048), () => {
      active--;
    });
  });
  const port = await listen(server);
  try {
    const progress = [];
    const result = await measure(`http://127.0.0.1:${port}/file`, {
      onSample: (item) => progress.push(item.number),
    });
    assert.equal(calls, 10);
    assert.equal(peak, 1);
    assert.equal(result.totalBytes, 30_720);
    assert.deepEqual(progress, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(new Set(urls).size, 1);
    assert.ok(result.averageMs > 0);
    assert.ok(result.megabitsPerSecond > 0);
  } finally {
    await close(server);
  }
});

test('integration: non-success response stops measurement', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(503);
    res.end('down');
  });
  const port = await listen(server);
  try {
    await assert.rejects(measure(`http://127.0.0.1:${port}/file`), /HTTP 503/);
  } finally {
    await close(server);
  }
});

test('integration: detects a human verification page', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<h1>Подтвердите, что вы человек</h1>');
  });
  const port = await listen(server);
  try {
    await assert.rejects(measure(`http://127.0.0.1:${port}/file`), /подтверждения человека/);
  } finally {
    await close(server);
  }
});

test('integration: request timeout interrupts a stalled response body', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200);
    res.write('partial');
  });
  const port = await listen(server);
  try {
    await assert.rejects(
      measure(`http://127.0.0.1:${port}/file`, { timeoutMs: 50, totalTimeoutMs: 500 }),
      /превышен таймаут/,
    );
  } finally {
    server.closeAllConnections();
    await close(server);
  }
});

test('integration: total timeout limits the full run', async () => {
  const server = createServer(async (_req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 40));
    res.end('ok');
  });
  const port = await listen(server);
  try {
    await assert.rejects(
      measure(`http://127.0.0.1:${port}/file`, { timeoutMs: 500, totalTimeoutMs: 70 }),
      /таймаут/,
    );
  } finally {
    await close(server);
  }
});

test('summary rejects empty input and handles an empty response', () => {
  assert.throws(() => summarize([]), /хотя бы один/);
  const summary = summarize([{ number: 1, bytes: 0, durationMs: 10 }]);
  assert.equal(summary.megabitsPerSecond, 0);
  assert.equal(summary.totalBytes, 0);
});

test('measurement rejects invalid counts and timeouts before requesting', async () => {
  const url = 'https://example.com/file';
  await assert.rejects(measure(url, { count: 0 }), /положительным/);
  await assert.rejects(measure(url, { timeoutMs: -1 }), /Таймауты/);
  await assert.rejects(measure(url, { totalTimeoutMs: 0 }), /Таймауты/);
});

test('integration: preserves a URL query and uses cache control headers', async () => {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ url: req.url, cacheControl: req.headers['cache-control'] });
    res.end('html or file');
  });
  const port = await listen(server);
  try {
    const result = await measure(`http://127.0.0.1:${port}/page?tag=8k`, { count: 2 });
    assert.equal(result.totalBytes, 24);
    assert.deepEqual(
      requests.map((item) => item.url),
      ['/page?tag=8k', '/page?tag=8k'],
    );
    assert.deepEqual(
      requests.map((item) => item.cacheControl),
      ['no-cache', 'no-cache'],
    );
  } finally {
    await close(server);
  }
});

test('integration: explains CAPTCHA response instead of a bare HTTP 403', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(403, { 'content-type': 'text/html' });
    res.end('<h1>Confirm that you are human</h1>');
  });
  const port = await listen(server);
  try {
    await assert.rejects(
      measure(`http://127.0.0.1:${port}/file`),
      /требует подтверждения человека.*HTTP 403/,
    );
  } finally {
    await close(server);
  }
});

test('integration: explains temporary IP block from site response', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(503, { 'content-type': 'text/html' });
    res.end('Ваше посещение сайта завершено, пожалуйста попробуйте зайти через 24 часа.');
  });
  const port = await listen(server);
  try {
    await assert.rejects(
      measure(`http://127.0.0.1:${port}/file`),
      /заблокировал доступ с вашего IP.*HTTP 503/,
    );
  } finally {
    await close(server);
  }
});
