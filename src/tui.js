#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { measure } from './measure.js';
import { formatBytes, formatMs, formatSpeed } from './format.js';

const terminal = createInterface({ input: stdin, output: stdout });
try {
  const url = process.argv[2] || await terminal.question('Адрес файла для измерения: ');
  stdout.write('\x1b[?25l');
  const result = await measure(url, { onSample: sample => {
    const done = '━'.repeat(sample.number);
    const remaining = '·'.repeat(10 - sample.number);
    stdout.write(`\r\x1b[2K${done}${remaining}  ${sample.number}/10  ${formatMs(sample.durationMs)}  ${formatBytes(sample.bytes)}`);
  }});
  stdout.write(`\n\nСкорость       ${formatSpeed(result.megabitsPerSecond)}\nСреднее время  ${formatMs(result.averageMs)}\nВсего данных   ${formatBytes(result.totalBytes)}\n`);
} catch (error) { console.error(`\nОшибка: ${error.message}`); process.exitCode = 1; }
finally { stdout.write('\x1b[?25h'); terminal.close(); }
