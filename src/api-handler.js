import { measure } from './measure.js';

const MAX_ACTIVE = 2;
const MAX_PER_MINUTE = 20;
const recentStarts = [];
const MAX_RESPONSE_BYTES = 50_000_000;
let activeMeasurements = 0;

/** Build the streaming API handler with an injectable fetcher for integration tests. */
export function createMeasureHandler(fetchImpl) {
  return async function post(request) {
    const origin = request.headers.get('origin');
    // Next may expose its bind address in request.url; the browser uses the Host header.
    const publicHost = request.headers.get('host') || new URL(request.url).host;
    if (origin && new URL(origin).host !== publicHost) {
      return Response.json({ error: 'Недопустимый источник запроса' }, { status: 403 });
    }
    const now = Date.now();
    while (recentStarts.length && recentStarts[0] < now - 60_000) recentStarts.shift();
    if (recentStarts.length >= MAX_PER_MINUTE)
      return Response.json(
        { error: 'Слишком много замеров. Повторите через минуту.' },
        { status: 429, headers: { 'retry-after': '60' } },
      );
    if (activeMeasurements >= MAX_ACTIVE) {
      return Response.json({ error: 'Сервис занят. Повторите попытку позже.' }, { status: 429 });
    }
    let url;
    try {
      ({ url } = await request.json());
    } catch {
      return Response.json({ error: 'Отправьте JSON с полем url' }, { status: 400 });
    }
    if (typeof url !== 'string' || url.length > 2048) {
      return Response.json({ error: 'Поле url должно быть строкой' }, { status: 400 });
    }
    recentStarts.push(now);
    activeMeasurements++;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (value) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
        try {
          const result = await measure(url, {
            fetchImpl,
            maxResponseBytes: MAX_RESPONSE_BYTES,
            onStart: (number) => send({ type: 'start', number }),
            onSample: (sample) => send({ type: 'sample', sample }),
          });
          send({ type: 'result', result });
        } catch (error) {
          send({ type: 'error', error: error.message });
        } finally {
          activeMeasurements--;
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  };
}
