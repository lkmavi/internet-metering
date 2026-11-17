'use client';
import { useState } from 'react';

const bytes = n => `${(n / 1_000_000).toFixed(2)} МБ`;
const speed = n => `${n.toFixed(2)} Мбит/с`;
const ms = n => `${Math.round(n)} мс`;

export default function Home() {
  const [url, setUrl] = useState('');
  const [samples, setSamples] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function run(event) {
    event.preventDefault(); setError(''); setSamples([]); setResult(null);
    try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Укажите адрес HTTP или HTTPS'); }
    catch (e) { setError(e.message === 'Invalid URL' ? 'Укажите полный адрес с http:// или https://' : e.message); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/measure', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
      if (!response.ok) throw new Error('Не удалось запустить измерение');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) { if (!line) continue; const item = JSON.parse(line); if (item.type === 'sample') setSamples(previous => [...previous, item.sample]); if (item.type === 'result') setResult(item.result); if (item.type === 'error') setError(item.error); }
      }
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  return <main id="main" className="shell">
    <header className="top"><div className="brand"><span className="brand-mark">◒</span> линия<span className="brand-dot">.</span></div><span className="top-note">ИНСТРУМЕНТ / 01</span></header>
    <section className="hero"><div className="eyebrow"><span className="live-dot"/> ПРОВЕРКА СОЕДИНЕНИЯ</div><h1>Сколько реально<br/>скачивает ваша сеть?</h1><p className="intro">Загрузим выбранный файл десять раз подряд и покажем среднее время, объём данных и скорость скачивания.</p></section>
    <section className="workbench" aria-label="Измерение скорости"><div className="workbench-head"><span>НОВЫЙ ЗАМЕР</span><span>10 ПОСЛЕДОВАТЕЛЬНЫХ ЗАПРОСОВ</span></div><form onSubmit={run} className="form"><label htmlFor="target">Адрес файла</label><div className="input-row"><input id="target" type="url" placeholder="https://example.com/large-image.jpg" value={url} onChange={e => setUrl(e.target.value)} required disabled={loading}/><button disabled={loading}>{loading ? 'Измеряем…' : 'Измерить скорость'} <span aria-hidden="true">↗</span></button></div><p className="hint">Выберите доступный файл достаточного размера. Адрес не изменяется; серверу отправляется запрос на свежий ответ.</p></form>
      <div className="progress-head"><span>ХОД ИЗМЕРЕНИЯ</span><span>{String(samples.length).padStart(2, '0')} / 10</span></div><div className="segments" role="progressbar" aria-valuenow={samples.length} aria-valuemin={0} aria-valuemax={10} aria-label="Выполнено запросов">{Array.from({length:10}, (_, i) => <span key={i} className={i < samples.length ? 'done' : ''}/>)}</div>
      {error && <p className="error" role="alert">{error}</p>}
      {result ? <div className="results" aria-live="polite"><div className="primary-result"><span>СКОРОСТЬ СКАЧИВАНИЯ</span><strong>{speed(result.megabitsPerSecond)}</strong></div><div className="secondary-result"><div><span>СРЕДНЕЕ ВРЕМЯ</span><strong>{ms(result.averageMs)}</strong></div><div><span>СКАЧАНО</span><strong>{bytes(result.totalBytes)}</strong></div></div></div> : <div className="empty">{loading ? `Загружено файлов: ${samples.length} из 10` : 'Результаты появятся здесь после замера.'}</div>}
    </section>
    <section className="details"><div><span className="section-index">01 / МЕТОД</span><h2>Простой замер.<br/>Понятный результат.</h2></div><div className="steps"><article><b>01</b><h3>Выберите файл</h3><p>Укажите прямую ссылку на изображение или другой доступный файл.</p></article><article><b>02</b><h3>Дождитесь загрузки</h3><p>Каждый из десяти запросов полностью завершается до следующего.</p></article><article><b>03</b><h3>Смотрите скорость</h3><p>Суммарные биты делятся на время загрузки всех файлов.</p></article></div></section>
    <footer><span>ЛИНИЯ / INTERNET METERING</span><span>Открытый инструмент · Node.js + Next.js</span></footer>
  </main>;
}
