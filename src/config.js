import 'dotenv/config';

function positiveMs(value, name, fallback) {
  if (value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`${name} должен быть положительным целым числом в миллисекундах`);
  return number;
}

/** Read validated defaults and optional environment overrides for all interfaces.
 * @param {NodeJS.ProcessEnv} env
 */
export function loadConfig(env = process.env) {
  return {
    url: env.METER_URL || '',
    requestTimeoutMs: positiveMs(env.METER_REQUEST_TIMEOUT_MS, 'METER_REQUEST_TIMEOUT_MS', 15_000),
    totalTimeoutMs: positiveMs(env.METER_TOTAL_TIMEOUT_MS, 'METER_TOTAL_TIMEOUT_MS', 120_000),
  };
}
