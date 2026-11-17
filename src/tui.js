#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { measure } from './measure.js';
import { loadConfig } from './config.js';
import { renderDashboard } from './tui-view.js';

const terminal = createInterface({ input: stdin, output: stdout });
const interactive = Boolean(stdout.isTTY);
const samples = [];
let timer;
let previousLines = 0;
let frame = 0;
let active = 1;
let url = '';

function draw(extra = {}) {
  const view = renderDashboard({ url, samples, active, frame, color: interactive, columns: stdout.columns || 80, ...extra });
  if (!interactive && !extra.result && !extra.error) return;
  if (interactive && previousLines) stdout.write(`\x1b[${previousLines}F\x1b[J`);
  stdout.write(view);
  previousLines = view.trimEnd().split('\n').length;
}

try {
  const config = loadConfig();
  url = process.argv[2] || config.url || await terminal.question('Адрес для измерения: ');
  if (interactive) stdout.write('\n\x1b[?25l');
  draw();
  if (interactive) timer = setInterval(() => { frame++; draw(); }, 150);
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
  if (interactive) stdout.write('\x1b[?25h\n');
  terminal.close();
}
