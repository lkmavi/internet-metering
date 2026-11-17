import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  { rules: { 'no-unused-vars': 'error', 'no-constant-condition': 'error' } },
  globalIgnores(['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts']),
]);
