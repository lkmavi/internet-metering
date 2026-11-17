import { formatBytes, formatMs, formatSpeed } from './format.js';

const ANSI = { reset: '\x1b[0m', text: '\x1b[38;2;224;229;235m', muted: '\x1b[38;2;136;145;157m', accent: '\x1b[38;2;93;188;222m', success: '\x1b[38;2;166;216;153m', error: '\x1b[38;2;239;135;135m' };
const tint = (text, tone, color) => color ? `${ANSI[tone]}${text}${ANSI.reset}` : text;
const blocks = '▁▂▃▄▅▆▇█';

/** Map per-request speeds to ten aligned terminal chart columns. */
export function sparkline(values) {
  if (!values.length) return Array(10).fill('·').join('  ');
  const max = Math.max(...values, 1);
  return Array.from({ length: 10 }, (_, index) => values[index] === undefined
    ? '·'
    : blocks[Math.min(7, Math.max(0, Math.ceil(values[index] / max * 8) - 1))]).join('  ');
}

/** Render a compact inline dashboard without taking over the terminal screen. */
export function renderDashboard({ url, samples, active, frame = 0, result = null, error = null, color = true, columns = 80 }) {
  const rates = samples.map(sample => sample.durationMs ? sample.bytes * 8 / sample.durationMs / 1000 : 0);
  const spinner = ['◐', '◓', '◑', '◒'][frame % 4];
  const status = error ? tint('Ошибка', 'error', color) : result ? tint('Готово', 'success', color) : `${tint(spinner, 'accent', color)} Запрос ${active} из 10`;
  const maxUrl = Math.max(25, Math.min(columns - 6, 90));
  const shownUrl = url.length > maxUrl ? `${url.slice(0, maxUrl - 1)}…` : url;
  const progress = `${tint('━'.repeat(samples.length), 'accent', color)}${tint('┄'.repeat(10 - samples.length), 'muted', color)}`;
  const rows = [
    `${tint('╭─', 'muted', color)} ${tint('Линия', 'accent', color)} ${tint('/ замер скорости', 'muted', color)}`,
    `  ${tint(shownUrl, 'text', color)}`,
    '',
    `  ${progress}  ${samples.length}/10    ${status}`,
    '',
    `  ${tint('Скорость запросов · Мбит/с', 'muted', color)}`,
    `  ${tint(sparkline(rates), 'accent', color)}`,
    `  ${tint(Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, '0')).join(' '), 'muted', color)}`,
    '',
  ];
  if (result) {
    rows.push(`  ${tint('Скорость'.padEnd(20), 'muted', color)} ${tint(formatSpeed(result.megabitsPerSecond), 'success', color)}`);
    rows.push(`  ${tint('Среднее время'.padEnd(20), 'muted', color)} ${formatMs(result.averageMs)}`);
    rows.push(`  ${tint('Скачано'.padEnd(20), 'muted', color)} ${formatBytes(result.totalBytes)}`);
  } else if (error) {
    rows.push(`  ${tint(error, 'error', color)}`);
  } else {
    rows.push(`  ${tint('Последний ответ', 'muted', color)}  ${samples.length ? `${formatMs(samples.at(-1).durationMs)} · ${formatBytes(samples.at(-1).bytes)}` : 'ожидание сервера…'}`);
  }
  rows.push(tint('╰─', 'muted', color));
  return rows.join('\n') + '\n';
}
