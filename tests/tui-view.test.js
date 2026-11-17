import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDashboard, sparkline } from '../src/tui-view.js';

test('sparkline renders ten positions from measured speeds', () => {
  assert.equal(sparkline([]), Array(10).fill('·').join('  '));
  assert.equal(sparkline([1, 2, 3]).length, 28);
  assert.equal(sparkline([1, 8]).slice(0, 4), '▁  █');
});

test('dashboard renders progress and result without terminal escapes in plain mode', () => {
  const sample = { number: 1, bytes: 1_000_000, durationMs: 1000 };
  const view = renderDashboard({ url: 'https://example.com/file', samples: [sample], active: 2, color: false, result: { megabitsPerSecond: 8, averageMs: 1000, totalBytes: 1_000_000 } });
  assert.match(view, /1\/10/);
  assert.match(view, /8.00 Мбит\/с/);
  assert.doesNotMatch(view, /\x1b\[/);
});

test('colored dashboard keeps metric columns aligned after ANSI codes are removed', () => {
  const result = { megabitsPerSecond: 8, averageMs: 1000, totalBytes: 1_000_000 };
  const view = renderDashboard({ url: 'https://example.com', samples: [{ number: 1, bytes: 1_000_000, durationMs: 1000 }], active: 1, result, color: true });
  const lines = view.replaceAll(/\x1b\[[0-9;]*m/g, '').split('\n');
  const metrics = lines.filter(line => /^(  Скорость {2,}|  Среднее время {2,}|  Скачано {2,})/.test(line));
  assert.equal(metrics.length, 3);
  assert.equal(new Set(metrics.map(line => line.search(/(?:8\.00 Мбит\/с|1000 мс|1\.00 МБ)/))).size, 1);
});
