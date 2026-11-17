import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicAddress, resolvePublicAddress, fetchPublic } from '../src/public-fetch.js';
import { createMeasureHandler } from '../src/api-handler.js';
import { measure } from '../src/measure.js';

const request = (url, origin) =>
  new Request('http://localhost/api/measure', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
    body: JSON.stringify({ url }),
  });

test('web target guard denies private, mapped, link-local, and reserved IPs', () => {
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.1.1',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    '192.0.2.1',
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2001:4860:4860::8888'), true);
});

test('web fetch rejects private targets before sending requests', async () => {
  await assert.rejects(resolvePublicAddress('localhost'), /внутренние адреса/);
  await assert.rejects(fetchPublic('http://127.0.0.1:1234/file'), /внутренние адреса/);
});

test('API rejects a foreign origin and oversized URL', async () => {
  const post = createMeasureHandler(fetch);
  assert.equal(
    (await post(request('https://example.com', 'https://attacker.example'))).status,
    403,
  );
  assert.equal((await post(request('https://example.com/' + 'x'.repeat(2100)))).status, 400);
});

test('measurement stops once the response byte limit is exceeded', async () => {
  const fetchImpl = async () => new Response('12345', { status: 200 });
  await assert.rejects(
    measure('https://example.com/file', { fetchImpl, count: 1, maxResponseBytes: 4 }),
    /размер ответа/,
  );
});

test('API accepts browser origin when Next binds to 0.0.0.0', async () => {
  const post = createMeasureHandler(async () => new Response('ok'));
  const request = new Request('http://0.0.0.0:3001/api/measure', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'localhost:3001',
      origin: 'http://localhost:3001',
    },
    body: JSON.stringify({ url: 'https://example.com/file' }),
  });
  const response = await post(request);
  assert.equal(response.status, 200);
  const events = (await response.text()).trim().split('\n').map(JSON.parse);
  assert.equal(events.at(-1).type, 'result');
});
