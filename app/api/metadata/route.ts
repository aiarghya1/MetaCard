import { fetchMetadata, MetadataError, type PageMetadata } from '@/lib/metadata';

export const runtime = 'edge';

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 200;
type RateRecord = { count: number; resetAt: number };
type CacheRecord = { value: PageMetadata; expiresAt: number };
const rateLimits = new Map<string, RateRecord>();
const metadataCache = new Map<string, CacheRecord>();

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) return errorResponse('UNSUPPORTED_MEDIA_TYPE', 'Send the request as application/json.', 415, requestId);
  if (Number(request.headers.get('content-length') ?? 0) > 2_500) return errorResponse('PAYLOAD_TOO_LARGE', 'The request body is too large.', 413, requestId);

  const rate = consumeRateLimit(clientKey(request));
  if (!rate.allowed) return errorResponse('RATE_LIMITED', 'Too many requests. Please try again shortly.', 429, requestId, {
    'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1_000))), 'X-RateLimit-Remaining': '0',
  });

  try {
    const rawBody = await request.text();
    if (rawBody.length > 2_500) return errorResponse('PAYLOAD_TOO_LARGE', 'The request body is too large.', 413, requestId);
    let body: { url?: unknown };
    try { body = JSON.parse(rawBody) as { url?: unknown }; } catch { return errorResponse('INVALID_JSON', 'The request body contains invalid JSON.', 400, requestId); }
    const cacheKey = typeof body.url === 'string' ? body.url.trim() : '';
    const cached = metadataCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return jsonResponse(cached.value, 200, requestId, rate.remaining, 'HIT');
    if (cached) metadataCache.delete(cacheKey);

    const metadata = await fetchMetadata(body.url);
    setCache(cacheKey, metadata);
    return jsonResponse(metadata, 200, requestId, rate.remaining, 'MISS');
  } catch (error) {
    if (error instanceof MetadataError) return errorResponse(error.code, error.message, error.status, requestId, { 'X-RateLimit-Remaining': String(rate.remaining) });
    console.error(JSON.stringify({ level: 'error', requestId, message: error instanceof Error ? error.message : 'Unknown metadata error' }));
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred.', 500, requestId);
  }
}

export function GET(): Response {
  return Response.json({ name: 'MetaCard metadata API', method: 'POST', contentType: 'application/json', example: { url: 'https://example.com' } }, { status: 200, headers: securityHeaders() });
}

function consumeRateLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now(); const existing = rateLimits.get(key);
  if (!existing || existing.resetAt <= now) {
    const record = { count: 1, resetAt: now + RATE_WINDOW_MS }; rateLimits.set(key, record); pruneRates(now);
    return { allowed: true, remaining: RATE_LIMIT - 1, resetAt: record.resetAt };
  }
  existing.count += 1;
  return { allowed: existing.count <= RATE_LIMIT, remaining: Math.max(0, RATE_LIMIT - existing.count), resetAt: existing.resetAt };
}
function clientKey(request: Request): string { return request.headers.get('cf-connecting-ip') || 'local-client'; }
function pruneRates(now: number): void { if (rateLimits.size < 500) return; for (const [key, record] of rateLimits) if (record.resetAt <= now) rateLimits.delete(key); }
function setCache(key: string, value: PageMetadata): void {
  if (!key) return;
  if (metadataCache.size >= MAX_CACHE_ENTRIES) metadataCache.delete(metadataCache.keys().next().value as string);
  metadataCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}
function jsonResponse(value: PageMetadata, status: number, requestId: string, remaining: number, cache: 'HIT' | 'MISS'): Response {
  return Response.json(value, { status, headers: { ...securityHeaders(), 'Cache-Control': 'private, max-age=60', 'X-Cache': cache, 'X-Request-Id': requestId, 'X-RateLimit-Limit': String(RATE_LIMIT), 'X-RateLimit-Remaining': String(remaining) } });
}
function errorResponse(code: string, message: string, status: number, requestId: string, headers: Record<string, string> = {}): Response {
  return Response.json({ error: { code, message, requestId } }, { status, headers: { ...securityHeaders(), 'Cache-Control': 'no-store', 'X-Request-Id': requestId, ...headers } });
}
function securityHeaders(): Record<string, string> { return { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" }; }
