import { formatBytes, formatMs, formatSpeed } from './format.js';

const C = { reset: '\x1b[0m', ink: '\x1b[38;2;225;246;238m', muted: '\x1b[38;2;139;177;166m', lime: '\x1b[38;2;188;242;105m', cyan: '\x1b[38;2;91;210;217m', coral: '\x1b[38;2;255;159;125m' };
const paint = (value, color, enabled) => enabled ? `${C[color]}${value}${C.reset}` : value;
const cells = '▁▂▃▄▅▆▇█';

export function sparkline(values) {
  if (!values.length) return '·'.repeat(10);
  const max = Math.max(...values, 1);
  return values.map(value => cells[Math.min(7, Math.max(0, Math.ceil(value / max * 8) - 1))]).join('') + '·'.repeat(Math.max(0, 10 - values.length));
}

export function renderDashboard({ url, samples, active, frame = 0, result = null, error = null, color = true }) {
  const widths = 54;
  const line = '─'.repeat(widths);
  const rates = samples.map(sample => sample.durationMs ? sample.bytes * 8 / sample.durationMs / 1000 : 0);
  const done = '■'.repeat(samples.length);
  const pending = '□'.repeat(10 - samples.length);
  const spinner = ['◐', '◓', '◑', '◒'][frame % 4];
  const label = result ? 'ЗАМЕР ЗАВЕРШЁН' : error ? 'ОШИБКА' : `${spinner}  ЗАПРОС ${active}/10 · ПОЛУЧАЕМ ОТВЕТ`;
  const rows = [
    paint('  ◒  Л И Н И Я    /    INTERNET METERING', 'lime', color),
    paint(`  ${line}`, 'muted', color),
    `  ${paint('АДРЕС', 'muted', color)}  ${url.length > 45 ? url.slice(0, 42) + '…' : url}`,
    `  ${paint('СТАТУС', 'muted', color)}  ${paint(label, error ? 'coral' : 'cyan', color)}`,
    '',
    `  ${paint(done, 'lime', color)}${paint(pending, 'muted', color)}   ${String(samples.length).padStart(2, '0')} / 10`,
    '',
    `  ${paint('СКОРОСТЬ ПО ЗАПРОСАМ · Мбит/с', 'muted', color)}`,
    `  ${paint(sparkline(rates), 'cyan', color)}`,
    `  ${paint('1 2 3 4 5 6 7 8 9 10', 'muted', color)}`,
    '',
    `  ${paint('ПОСЛЕДНИЙ ОТВЕТ', 'muted', color)}  ${samples.length ? `${formatMs(samples.at(-1).durationMs)} · ${formatBytes(samples.at(-1).bytes)}` : 'ожидание'}`,
  ];
  if (result) rows.push('', `  ${paint('СКОРОСТЬ', 'muted', color)}         ${paint(formatSpeed(result.megabitsPerSecond), 'lime', color)}`, `  ${paint('СРЕДНЕЕ ВРЕМЯ', 'muted', color)}    ${formatMs(result.averageMs)}`, `  ${paint('СКАЧАНО', 'muted', color)}         ${formatBytes(result.totalBytes)}`);
  if (error) rows.push('', `  ${paint(error, 'coral', color)}`);
  rows.push(paint(`  ${line}`, 'muted', color));
  return rows.join('\n') + '\n';
}
