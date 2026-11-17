import { getMessages, resolveLanguage } from './i18n.js';

/** Format measurement units for the selected interface language. */
export const formatMs = (value, language = 'ru') =>
  `${value.toFixed(0)} ${getMessages(language).unitMs}`;
export const formatBytes = (value, language = 'ru') =>
  `${(value / 1_000_000).toFixed(2)} ${getMessages(language).unitMb}`;
export const formatSpeed = (value, language = 'ru') =>
  `${value.toFixed(2)} ${getMessages(resolveLanguage(language)).unitMbps}`;
