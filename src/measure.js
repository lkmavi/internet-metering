import { performance } from 'node:perf_hooks';
import { loadConfig } from './config.js';

export const REQUEST_COUNT = 10;
export const DEFAULT_TIMEOUT_MS = 15_000;

/** @typedef {{number: number, durationMs: number, bytes: number}} Sample */

/**
 * Validate a user supplied target without changing its path or query string.
 * @param {string} input
 * @returns {URL}
 */
export function validateUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error('Укажите корректный URL с http:// или https://');
  }
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Поддерживаются только HTTP и HTTPS');
  if (url.username || url.password) throw new Error('URL с учётными данными не поддерживается');
  return url;
}

/**
 * Calculate throughput from the total bytes and the sum of request durations.
 * @param {Sample[]} samples
 */
export function summarize(samples) {
  if (samples.length === 0) throw new Error('Для расчёта нужен хотя бы один запрос');
  const totalBytes = samples.reduce((sum, sample) => sum + sample.bytes, 0);
  const totalMs = samples.reduce((sum, sample) => sum + sample.durationMs, 0);
  return {
    count: samples.length,
    totalBytes,
    averageMs: totalMs / samples.length,
    megabitsPerSecond: totalMs ? (totalBytes * 8) / totalMs / 1000 : 0,
    samples,
  };
}

/**
 * Read one response to completion. Only a small HTML prefix is retained to detect challenge pages.
 * @param {Response} response
 * @param {number} number
 * @returns {Promise<number>} Downloaded bytes
 */
async function consumeResponse(response, number) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Запрос ${number}: HTTP ${response.status}`);
  }
  const isHtml = (response.headers.get('content-type') || '').includes('text/html');
  const htmlChunks = [];
  let htmlBytes = 0;
  let bytes = 0;
  if (response.body) {
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (isHtml && htmlBytes < 1_000_000) {
        htmlChunks.push(chunk.subarray(0, 1_000_000 - htmlBytes));
        htmlBytes += Math.min(chunk.byteLength, 1_000_000 - htmlBytes);
      }
    }
  }
  if (isHtml) {
    const page = Buffer.concat(htmlChunks).toString('utf8');
    if (
      /подтвердите, что вы человек|confirm that you are human|\/captcha\//i.test(page) ||
      /\/captcha\//i.test(response.url)
    ) {
      throw new Error(
        'Сайт запросил подтверждение человека. Откройте адрес в браузере и выберите другой файл для замера.',
      );
    }
  }
  return bytes;
}

/**
 * Download the target sequentially and report each completed sample.
 * @param {string} input
 * @param {{count?: number, timeoutMs?: number, totalTimeoutMs?: number, fetchImpl?: typeof fetch, clock?: () => number, onStart?: (number: number) => void | Promise<void>, onSample?: (sample: Sample) => void | Promise<void>}} options
 */
export async function measure(input, options = {}) {
  const config = loadConfig();
  const {
    count = REQUEST_COUNT,
    timeoutMs = config.requestTimeoutMs,
    totalTimeoutMs = config.totalTimeoutMs,
    fetchImpl = fetch,
    clock = () => performance.now(),
    onSample = () => {},
    onStart = () => {},
  } = options;
  const url = validateUrl(input);
  if (!Number.isInteger(count) || count < 1)
    throw new Error('Количество запросов должно быть положительным целым числом');
  if (![timeoutMs, totalTimeoutMs].every((value) => Number.isSafeInteger(value) && value > 0))
    throw new Error('Таймауты должны быть положительными целыми числами');
  const deadline = clock() + totalTimeoutMs;
  const samples = [];
  for (let index = 0; index < count; index++) {
    const remaining = deadline - clock();
    if (remaining <= 0)
      throw new Error(
        `Общий таймаут ${totalTimeoutMs} мс: завершено ${samples.length} из ${count} запросов`,
      );
    const limit = Math.max(1, Math.floor(Math.min(timeoutMs, remaining)));
    const started = clock();
    await onStart(index + 1);
    let bytes;
    try {
      const response = await fetchImpl(new URL(url), {
        signal: AbortSignal.timeout(limit),
        headers: {
          'cache-control': 'no-cache',
          pragma: 'no-cache',
          'accept-encoding': 'identity',
          'user-agent': 'InternetMetering/1.0 (+local speed test)',
        },
        redirect: 'follow',
      });
      bytes = await consumeResponse(response, index + 1);
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError')
        throw new Error(`Запрос ${index + 1}: превышен таймаут (${limit} мс)`);
      throw error;
    }
    const sample = { number: index + 1, durationMs: clock() - started, bytes };
    samples.push(sample);
    await onSample(sample);
  }
  return summarize(samples);
}
