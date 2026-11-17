import { createMeasureHandler } from '../../../src/api-handler.js';
import { fetchPublic } from '../../../src/public-fetch.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = createMeasureHandler(fetchPublic);
