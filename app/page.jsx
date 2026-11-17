'use client';
import { useEffect, useState } from 'react';
import { getMessages, supportedLanguages } from '../src/i18n.js';

const bytes = (n, t) => `${(n / 1_000_000).toFixed(2)} ${t.unitMb}`;
const speed = (n, t) => `${n.toFixed(2)} ${t.unitMbps}`;
const ms = (n, t) => `${Math.round(n)} ${t.unitMs}`;
const rate = (sample) => (sample.durationMs ? (sample.bytes * 8) / sample.durationMs / 1000 : 0);

export default function Home() {
  const [language, setLanguage] = useState('ru');
  const t = getMessages(language);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const [url, setUrl] = useState('');
  const [samples, setSamples] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const rates = samples.map(rate);
  const chartMax = Math.max(...rates, 1);
  async function run(event) {
    event.preventDefault();
    setError('');
    setSamples([]);
    setResult(null);
    setActive(0);
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(t.invalidProtocol);
    } catch (e) {
      setError(e.message === 'Invalid URL' ? t.invalidUrl : e.message);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/measure', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || t.startFailed);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line) continue;
          const item = JSON.parse(line);
          if (item.type === 'start') setActive(item.number);
          if (item.type === 'sample') setSamples((previous) => [...previous, item.sample]);
          if (item.type === 'result') setResult(item.result);
          if (item.type === 'error') setError(item.error);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <main id="main" className="shell">
      <header className="top">
        <div className="brand">
          <span className="brand-mark">◒</span> {t.brand}
          <span className="brand-dot">.</span>
        </div>
        <div className="top-actions">
          <span className="top-note">INTERNET METER / 01</span>
          <label className="language-picker">
            <span className="sr-only">Language</span>
            <select
              aria-label="Language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              {supportedLanguages.map((code) => (
                <option key={code} value={code}>
                  {code.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <section className="hero">
        <div className="eyebrow">
          <span className="live-dot" /> {t.eyebrow}
        </div>
        <h1>{t.hero}</h1>
        <p className="intro">{t.intro}</p>
      </section>
      <section className="workbench" aria-label={t.title}>
        <div className="workbench-head">
          <span>{t.newRun}</span>
          <span>{t.sequential}</span>
        </div>
        <form onSubmit={run} className="form">
          <label htmlFor="target">{t.address}</label>
          <div className="input-row">
            <input
              id="target"
              type="url"
              placeholder="https://example.com/large-image.jpg"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={loading}
            />
            <button disabled={loading}>
              {loading ? t.buttonLoading : t.button} <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p className="hint">{t.hint}</p>
        </form>
        <div className="progress-head">
          <span>{t.progress}</span>
          <span>{String(samples.length).padStart(2, '0')} / 10</span>
        </div>
        <div
          className="segments"
          role="progressbar"
          aria-valuenow={samples.length}
          aria-valuemin={0}
          aria-valuemax={10}
          aria-label={t.progress}
        >
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              className={
                i < samples.length ? 'done' : loading && i === samples.length ? 'current' : ''
              }
            />
          ))}
        </div>
        <div className="visual-grid">
          <div className="chart-card">
            <div className="chart-title">
              <div>
                <span>{t.chart}</span>
                <h2>{t.chartTitle}</h2>
              </div>
              <span className="chart-unit">{t.chartUnit}</span>
            </div>
            <div
              className="chart-area"
              role="img"
              aria-label={
                rates.length
                  ? `${t.chart}: ${rates.map((value) => value.toFixed(2)).join(', ')}`
                  : t.dataAfter
              }
            >
              <div className="chart-grid">
                <span>{chartMax.toFixed(1)}</span>
                <span>{(chartMax / 2).toFixed(1)}</span>
                <span>0</span>
              </div>
              <div className="bars">
                {Array.from({ length: 10 }, (_, index) => (
                  <div className="bar-column" key={index}>
                    <div
                      className={`bar ${rates[index] !== undefined ? 'filled' : loading && index === samples.length ? 'waiting' : ''}`}
                      style={{
                        '--bar-height':
                          rates[index] !== undefined
                            ? `${Math.max(6, (rates[index] / chartMax) * 100)}%`
                            : '7%',
                      }}
                      title={
                        rates[index] !== undefined
                          ? `${rate(samples[index]).toFixed(2)} ${t.unitMbps}`
                          : undefined
                      }
                    />
                    <span>{String(index + 1).padStart(2, '0')}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="chart-foot">
              <span>01 · {t.chartFirst}</span>
              <span>10 · {t.chartLast}</span>
            </div>
          </div>
          <aside className="live-card">
            <div className="live-card-head">
              <span className={loading ? 'pulse-dot' : 'live-dot'} />{' '}
              {loading ? t.running : result ? t.completed : t.ready}
            </div>
            <div className="live-card-body">
              <span>{t.current}</span>
              <strong>
                {loading ? String(active || 1).padStart(2, '0') : result ? '10' : '—'}
                <small> / 10</small>
              </strong>
              <p>{loading ? t.waitingResponse : result ? t.allDone : t.enterAddress}</p>
            </div>
            <div className="live-card-bottom">
              {samples.length
                ? `${t.lastShort}: ${ms(samples.at(-1).durationMs, t)} · ${bytes(samples.at(-1).bytes, t)}`
                : t.dataAfter}
            </div>
          </aside>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {result ? (
          <div className="results" aria-live="polite">
            <div className="primary-result">
              <span>{t.downloadSpeed}</span>
              <strong>{speed(result.megabitsPerSecond, t)}</strong>
            </div>
            <div className="secondary-result">
              <div>
                <span>{t.averageTime}</span>
                <strong>{ms(result.averageMs, t)}</strong>
              </div>
              <div>
                <span>{t.downloadedCaps}</span>
                <strong>{bytes(result.totalBytes, t)}</strong>
              </div>
            </div>
          </div>
        ) : null}
      </section>
      <section className="details">
        <div>
          <span className="section-index">01 / {t.method}</span>
          <h2>{t.methodTitle}</h2>
        </div>
        <div className="steps">
          <article>
            <b>01</b>
            <h3>{t.step1}</h3>
            <p>{t.step1Text}</p>
          </article>
          <article>
            <b>02</b>
            <h3>{t.step2}</h3>
            <p>{t.step2Text}</p>
          </article>
          <article>
            <b>03</b>
            <h3>{t.step3}</h3>
            <p>{t.step3Text}</p>
          </article>
        </div>
      </section>
      <footer>
        <span>{t.brand.toUpperCase()} / INTERNET METERING</span>
        <span>{t.footer}</span>
      </footer>
    </main>
  );
}
