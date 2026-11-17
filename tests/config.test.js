import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

test('configuration uses defaults and accepts environment overrides', () => {
  assert.deepEqual(loadConfig({}), { url: '', requestTimeoutMs: 15_000, totalTimeoutMs: 120_000 });
  assert.deepEqual(loadConfig({ METER_URL: 'https://example.com', METER_REQUEST_TIMEOUT_MS: '500', METER_TOTAL_TIMEOUT_MS: '2000' }), { url: 'https://example.com', requestTimeoutMs: 500, totalTimeoutMs: 2000 });
});

test('configuration rejects invalid timeout values', () => {
  assert.throws(() => loadConfig({ METER_REQUEST_TIMEOUT_MS: '0' }), /положительным/);
  assert.throws(() => loadConfig({ METER_TOTAL_TIMEOUT_MS: 'abc' }), /положительным/);
});
