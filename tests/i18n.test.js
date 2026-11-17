import test from 'node:test';
import assert from 'node:assert/strict';
import { getMessages, resolveLanguage, supportedLanguages } from '../src/i18n.js';
import { formatSpeed } from '../src/format.js';
import { renderDashboard } from '../src/tui-view.js';

test('all supported languages contain the same translation keys', () => {
  const keys = Object.keys(getMessages('ru')).sort();
  for (const language of supportedLanguages) {
    assert.deepEqual(Object.keys(getMessages(language)).sort(), keys);
    assert.ok(Object.values(getMessages(language)).every(Boolean));
  }
});

test('language resolution handles regional codes and unknown languages', () => {
  assert.equal(resolveLanguage('en-US'), 'en');
  assert.equal(resolveLanguage('DE-de'), 'de');
  assert.equal(resolveLanguage('fr'), 'ru');
  assert.equal(formatSpeed(8, 'en'), '8.00 Mbps');
});

test('terminal dashboard switches copy and units', () => {
  const view = renderDashboard({
    url: 'https://example.com',
    samples: [],
    active: 1,
    color: false,
    language: 'de',
  });
  assert.match(view, /Anfrage 1 von 10/);
  assert.match(view, /Warte auf Server/);
});
