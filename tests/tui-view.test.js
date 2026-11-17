import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDashboard, sparkline } from '../src/tui-view.js';

test('sparkline renders ten positions from measured speeds', () => {
  assert.equal(sparkline([]), '··········');
  assert.equal(sparkline([1, 2, 3]).length, 10);
  assert.equal(sparkline([1, 8]).slice(0, 2), '▁█');
});

test('dashboard renders progress and result without terminal escapes in plain mode', () => {
  const sample = { number: 1, bytes: 1_000_000, durationMs: 1000 };
  const view = renderDashboard({ url: 'https://example.com/file', samples: [sample], active: 2, color: false, result: { megabitsPerSecond: 8, averageMs: 1000, totalBytes: 1_000_000 } });
  assert.match(view, /01 \/ 10/);
  assert.match(view, /8.00 Мбит\/с/);
  assert.doesNotMatch(view, /\x1b\[/);
});
