#!/usr/bin/env node
import { measure } from './measure.js';
import { formatBytes, formatMs, formatSpeed } from './format.js';

const url = process.argv[2];
if (!url) { console.error('Использование: npm run measure -- https://example.com/file'); process.exitCode = 2; }
else {
  try {
    console.log(`Измерение: ${url}\n`);
    const result = await measure(url, { onSample: sample => console.log(`${String(sample.number).padStart(2)} / 10   ${formatMs(sample.durationMs).padStart(8)}   ${formatBytes(sample.bytes)}`) });
    console.log(`\nСреднее время: ${formatMs(result.averageMs)}\nСкачано: ${formatBytes(result.totalBytes)}\nСкорость: ${formatSpeed(result.megabitsPerSecond)}`);
  } catch (error) { console.error(`Ошибка: ${error.message}`); process.exitCode = 1; }
}
