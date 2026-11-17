import { measure } from '../../../src/measure.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Stream one JSON event per line so the browser can update as requests finish. */
export async function POST(request) {
  let url;
  try { ({ url } = await request.json()); }
  catch { return Response.json({ error: 'Отправьте JSON с полем url' }, { status: 400 }); }
  if (typeof url !== 'string') return Response.json({ error: 'Поле url должно быть строкой' }, { status: 400 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = value => controller.enqueue(encoder.encode(JSON.stringify(value) + '\n'));
      try { const result = await measure(url, { onStart: number => send({ type: 'start', number }), onSample: sample => send({ type: 'sample', sample }) }); send({ type: 'result', result }); }
      catch (error) { send({ type: 'error', error: error.message }); }
      finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}
