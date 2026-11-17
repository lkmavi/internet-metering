'use client';

import { useEffect, useState } from 'react';
import { getMessages, supportedLanguages } from '../src/i18n.js';

const formatBytes = (n, t) => `${(n / 1_000_000).toFixed(2)} ${t.unitMb}`;
const formatSpeed = (n, t) => `${n.toFixed(2)} ${t.unitMbps}`;
const formatMs = (n, t) => `${Math.round(n)} ${t.unitMs}`;
const requestSpeed = (sample) => (sample.bytes * 8) / sample.durationMs / 1000;

export default function Home() {
  const [language, setLanguage] = useState('ru');
  const [url, setUrl] = useState('');
  const [samples, setSamples] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const t = getMessages(language);
  const rates = samples.map(requestSpeed);
  const maxRate = Math.max(...rates, 1);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  async function run(event) {
    event.preventDefault();
    setError('');
    setSamples([]);
    setResult(null);
    setActive(0);
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(t.invalidProtocol);
    } catch (cause) {
      setError(cause.message === 'Invalid URL' ? t.invalidUrl : cause.message);
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
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main id="main" className="site">
      <header className="site-header">
        <a className="wordmark" href="#main" aria-label={t.brand}>
          <span className="wordmark-symbol" aria-hidden="true">
            ◌
          </span>
          {t.brand}
          <span className="wordmark-period">.</span>
        </a>
        <div className="header-actions">
          <span className="header-caption">INTERNET METER / 01</span>
          <label className="language-control">
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

      <section className="intro-section" aria-labelledby="page-title">
        <div className="intro-copy">
          <p className="eyebrow">
            <span className="eyebrow-line" /> {t.eyebrow}
          </p>
          <h1 id="page-title">{t.hero}</h1>
          <p className="lead">{t.intro}</p>
        </div>
        <div className="intro-aside" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="orbit orbit-three" />
          <span className="orbit-center">10</span>
          <span className="orbit-caption">SEQUENTIAL REQUESTS</span>
        </div>
      </section>

      <section className="measurement" aria-label={t.title}>
        <div className="measurement-heading">
          <div>
            <span className="section-tag">01 / {t.newRun}</span>
            <h2>{t.button}</h2>
          </div>
          <span className="measurement-count">10 × HTTP</span>
        </div>
        <form className="measure-form" onSubmit={run}>
          <label htmlFor="target">{t.address}</label>
          <div className="measure-fields">
            <input
              id="target"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/file.zip"
              required
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              <span>{loading ? t.buttonLoading : t.button}</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <p className="form-note">{t.hint}</p>
        </form>
        <div className="measurement-status" aria-live="polite">
          <div className="status-text">
            <span
              className={`status-light ${loading ? 'active' : error ? 'failed' : result ? 'complete' : ''}`}
            />
            {error ? t.statusError : loading ? t.running : result ? t.completed : t.ready}
          </div>
          <span>{String(samples.length).padStart(2, '0')} / 10</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={samples.length}
          aria-valuemin={0}
          aria-valuemax={10}
          aria-label={t.progress}
        >
          {Array.from({ length: 10 }, (_, index) => (
            <span
              key={index}
              className={
                index < samples.length
                  ? 'complete'
                  : loading && index === samples.length
                    ? 'active'
                    : ''
              }
            />
          ))}
        </div>
        {error && (
          <div className="error-message" role="alert">
            <span aria-hidden="true">!</span>
            <p>{error}</p>
          </div>
        )}
      </section>

      <section className="readout" aria-label={t.chartTitle}>
        <div className="readout-header">
          <div>
            <span className="section-tag">02 / {t.progress}</span>
            <h2>{t.chartTitle}</h2>
          </div>
          <p>{loading ? t.waitingResponse : result ? t.allDone : t.dataAfter}</p>
        </div>
        <div className="metrics">
          <article className="metric metric-featured">
            <span>{t.downloadSpeed}</span>
            <strong>{result ? formatSpeed(result.megabitsPerSecond, t) : '—'}</strong>
            <small>{t.chartUnit}</small>
          </article>
          <article className="metric">
            <span>{t.averageTime}</span>
            <strong>{result ? formatMs(result.averageMs, t) : '—'}</strong>
            <small>{t.sequential}</small>
          </article>
          <article className="metric">
            <span>{t.downloadedCaps}</span>
            <strong>{result ? formatBytes(result.totalBytes, t) : '—'}</strong>
            <small>
              {t.current}: {loading ? active || 1 : result ? 10 : 0} / 10
            </small>
          </article>
        </div>
        <div className="chart-panel">
          <div className="chart-heading">
            <span>{t.chart}</span>
            <span>{t.chartUnit}</span>
          </div>
          <div
            className="chart-bars"
            role="img"
            aria-label={
              rates.length
                ? `${t.chart}: ${rates.map((value) => value.toFixed(2)).join(', ')}`
                : t.dataAfter
            }
          >
            {Array.from({ length: 10 }, (_, index) => (
              <div className="chart-column" key={index}>
                <div
                  className={`chart-bar ${rates[index] !== undefined ? 'has-value' : loading && index === samples.length ? 'is-active' : ''}`}
                  style={{
                    '--bar-height':
                      rates[index] === undefined
                        ? '8%'
                        : `${Math.max(8, (rates[index] / maxRate) * 100)}%`,
                  }}
                  title={rates[index] === undefined ? undefined : formatSpeed(rates[index], t)}
                />
                <span>{String(index + 1).padStart(2, '0')}</span>
              </div>
            ))}
          </div>
          <div className="chart-footer">
            <span>{t.chartFirst}</span>
            <span>{t.chartLast}</span>
          </div>
        </div>
      </section>

      <section className="method" aria-labelledby="method-title">
        <div>
          <span className="section-tag">03 / {t.method}</span>
          <h2 id="method-title">{t.methodTitle}</h2>
        </div>
        <div className="method-steps">
          <article>
            <span>01</span>
            <h3>{t.step1}</h3>
            <p>{t.step1Text}</p>
          </article>
          <article>
            <span>02</span>
            <h3>{t.step2}</h3>
            <p>{t.step2Text}</p>
          </article>
          <article>
            <span>03</span>
            <h3>{t.step3}</h3>
            <p>{t.step3Text}</p>
          </article>
        </div>
      </section>
      <footer className="site-footer">
        <span>{t.brand.toUpperCase()} / INTERNET METERING</span>
        <span>{t.footer}</span>
      </footer>
    </main>
  );
}
