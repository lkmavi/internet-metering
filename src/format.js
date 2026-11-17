export const formatMs = value => `${value.toFixed(0)} мс`;
export const formatBytes = value => `${(value / 1_000_000).toFixed(2)} МБ`;
export const formatSpeed = value => `${value.toFixed(2)} Мбит/с`;
