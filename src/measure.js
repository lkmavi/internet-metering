import { performance } from 'node:perf_hooks';

export const REQUEST_COUNT = 10;
export const DEFAULT_TIMEOUT_MS = 30_000;

export function validateUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new Error('Укажите корректный URL с http:// или https://'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Поддерживаются только HTTP и HTTPS');
  if (url.username || url.password) throw new Error('URL с учётными данными не поддерживается');
  return url;
}

export function summarize(samples) {
  const totalBytes = samples.reduce((sum, sample) => sum + sample.bytes, 0);
  const totalSeconds = samples.reduce((sum, sample) => sum + sample.durationMs, 0) / 1000;
  return {
    count: samples.length,
    totalBytes,
    averageMs: samples.reduce((sum, sample) => sum + sample.durationMs, 0) / samples.length,
    megabitsPerSecond: totalSeconds ? totalBytes * 8 / totalSeconds / 1_000_000 : 0,
    samples,
  };
}

export async function measure(input, { count = REQUEST_COUNT, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch, clock = () => performance.now(), onSample = () => {} } = {}) {
  const url = validateUrl(input);
  if (!Number.isInteger(count) || count < 1) throw new Error('Количество запросов должно быть положительным целым числом');
  const samples = [];
  for (let index = 0; index < count; index++) {
    const requestUrl = new URL(url);
    const started = clock();
    const response = await fetchImpl(requestUrl, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'cache-control': 'no-cache', 'pragma': 'no-cache', 'accept-encoding': 'identity', 'user-agent': 'InternetMetering/1.0 (+local speed test)' },
      redirect: 'follow',
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Запрос ${index + 1}: HTTP ${response.status}`); }
    let bytes = 0;
    const contentType = response.headers.get('content-type') || '';
    const html = contentType.includes('text/html') ? [] : null;
    if (response.body) for await (const chunk of response.body) { bytes += chunk.byteLength; if (html && bytes <= 1_000_000) html.push(chunk); }
    if (html) {
      const page = Buffer.concat(html).toString('utf8');
      if (/подтвердите, что вы человек|confirm that you are human|\/captcha\//i.test(page) || /\/captcha\//i.test(response.url)) throw new Error('Сайт запросил подтверждение человека. Откройте адрес в браузере и выберите другой файл для замера.');
    }
    const sample = { number: index + 1, durationMs: clock() - started, bytes };
    samples.push(sample);
    await onSample(sample);
  }
  return summarize(samples);
}
