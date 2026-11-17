#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { measure } from './measure.js';
import { loadConfig } from './config.js';
import { renderDashboard } from './tui-view.js';

const terminal = createInterface({ input: stdin, output: stdout });
let timer;
let url = '';
let active = 1;
let frame = 0;
const samples = [];
const interactive = Boolean(stdout.isTTY);
const draw = extra => {
  const output = renderDashboard({ url, samples, active, frame, color: interactive, ...extra });
  if (interactive) stdout.write(`\x1b[H\x1b[2J${output}`);
  else if (extra?.result || extra?.error) stdout.write(output);
};
try {
  const config = loadConfig();
  url = process.argv[2] || config.url || await terminal.question('Адрес для измерения: ');
  if (interactive) stdout.write('\x1b[?25l');
  draw();
  if (interactive) timer = setInterval(() => { frame++; draw(); }, 120);
  const result = await measure(url, {
    timeoutMs: config.requestTimeoutMs,
    totalTimeoutMs: config.totalTimeoutMs,
    onStart: number => { active = number; draw(); },
    onSample: sample => { samples.push(sample); draw(); },
  });
  clearInterval(timer);
  draw({ result });
} catch (error) {
  clearInterval(timer);
  draw({ error: error.message });
  process.exitCode = 1;
} finally {
  if (interactive) stdout.write('\x1b[?25h');
  terminal.close();
}
