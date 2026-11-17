#!/usr/bin/env node
import { measure } from './measure.js';
import { loadConfig } from './config.js';
import { formatBytes, formatMs, formatSpeed } from './format.js';
import { getMessages } from './i18n.js';

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(`Ошибка конфигурации: ${error.message}`);
  process.exit(2);
}
const t = getMessages(config.language);
const url = process.argv[2] || config.url;
if (!url) {
  console.error(t.usage);
  process.exitCode = 2;
} else {
  try {
    console.log(`${t.measuring}: ${url}\n`);
    const result = await measure(url, {
      timeoutMs: config.requestTimeoutMs,
      totalTimeoutMs: config.totalTimeoutMs,
      onStart: (number) => console.log(`${t.request} ${number}/10…`),
      onSample: (sample) =>
        console.log(
          `${String(sample.number).padStart(2)} / 10   ${formatMs(sample.durationMs, config.language).padStart(8)}   ${formatBytes(sample.bytes, config.language)}`,
        ),
    });
    console.log(
      `\n${t.average}: ${formatMs(result.averageMs, config.language)}\n${t.downloaded}: ${formatBytes(result.totalBytes, config.language)}\n${t.speed}: ${formatSpeed(result.megabitsPerSecond, config.language)}`,
    );
  } catch (error) {
    console.error(`${t.error}: ${error.message}`);
    process.exitCode = 1;
  }
}
