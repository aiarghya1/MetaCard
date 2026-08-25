export type PageMetadata = {
  url: string; finalUrl: string; title: string; description: string; image: string | null;
  siteName: string; favicon: string | null; type: string; fetchedAt: string;
};

export class MetadataError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message); this.name = 'MetadataError';
  }
}

const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 8_000;
const ALLOWED_PORTS = new Set(['', '80', '443']);

export function validatePublicUrl(input: unknown): URL {
  if (typeof input !== 'string' || input.trim().length === 0) throw new MetadataError('INVALID_URL', 'Enter a valid public webpage URL.', 400);
  if (input.length > 2_048) throw new MetadataError('INVALID_URL', 'The URL is too long.', 400);
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new MetadataError('INVALID_URL', 'Enter a complete URL beginning with http:// or https://.', 400); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new MetadataError('UNSAFE_URL', 'Only public HTTP and HTTPS URLs are supported.', 400);
  if (!ALLOWED_PORTS.has(url.port)) throw new MetadataError('UNSAFE_URL', 'Non-standard network ports are not supported.', 400);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (isBlockedHostname(hostname)) throw new MetadataError('UNSAFE_URL', 'Local and private network addresses are not allowed.', 400);
  url.hash = '';
  return url;
}

export async function fetchMetadata(input: unknown): Promise<PageMetadata> {
  const requestedUrl = validatePublicUrl(input);
  let currentUrl = requestedUrl;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: 'manual', signal: controller.signal,
        headers: { Accept: 'text/html,application/xhtml+xml;q=0.9', 'User-Agent': 'MetaCardBot/1.0 (+https://metacard.app)' },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new MetadataError('FETCH_TIMEOUT', 'The webpage took too long to respond.', 504);
      throw new MetadataError('FETCH_FAILED', 'The webpage could not be reached.', 502);
    } finally { clearTimeout(timeout); }

    if (isRedirect(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirectCount === MAX_REDIRECTS) throw new MetadataError('TOO_MANY_REDIRECTS', 'The webpage redirected too many times.', 422);
      currentUrl = validatePublicUrl(new URL(location, currentUrl).toString());
      continue;
    }
    if (!response.ok) throw new MetadataError('UPSTREAM_ERROR', `The webpage returned HTTP ${response.status}.`, 422);
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw new MetadataError('UNSUPPORTED_CONTENT', 'That URL does not point to an HTML webpage.', 415);
    if (Number(response.headers.get('content-length') ?? 0) > MAX_HTML_BYTES) throw new MetadataError('PAGE_TOO_LARGE', 'The webpage is too large to process safely.', 413);
    const html = await readBoundedText(response, MAX_HTML_BYTES);
    return parseMetadata(html, requestedUrl, currentUrl);
  }
  throw new MetadataError('FETCH_FAILED', 'The webpage could not be processed.', 502);
}

export function parseMetadata(html: string, requestedUrl: URL, finalUrl: URL): PageMetadata {
  const headEnd = html.search(/<\/head\s*>/i);
  const head = html.slice(0, headEnd >= 0 ? headEnd : Math.min(html.length, 250_000));
  const meta = new Map<string, string>();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(tag);
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    if (key && attrs.content && !meta.has(key)) meta.set(key, cleanText(attrs.content, 1_000));
  }
  const titleTag = head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? '';
  const title = first(meta.get('og:title'), meta.get('twitter:title'), cleanText(titleTag, 240), finalUrl.hostname);
  const description = first(meta.get('og:description'), meta.get('twitter:description'), meta.get('description'));
  return {
    url: requestedUrl.toString(), finalUrl: finalUrl.toString(), title: cleanText(title, 240), description: cleanText(description, 500),
    image: resolveHttpAsset(first(meta.get('og:image:secure_url'), meta.get('og:image'), meta.get('twitter:image')), finalUrl),
    siteName: cleanText(first(meta.get('og:site_name'), finalUrl.hostname.replace(/^www\./, '')), 120),
    favicon: findFavicon(head, finalUrl), type: cleanText(first(meta.get('og:type'), 'website'), 80), fetchedAt: new Date().toISOString(),
  };
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break; total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new MetadataError('PAGE_TOO_LARGE', 'The webpage is too large to process safely.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}; const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g; let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag))) attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  return attrs;
}

function findFavicon(head: string, baseUrl: URL): string | null {
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const attrs = parseAttributes(tag);
    if (attrs.href && /(^|\s)(shortcut icon|icon|apple-touch-icon)(\s|$)/i.test(attrs.rel ?? '')) {
      const resolved = resolveHttpAsset(attrs.href, baseUrl); if (resolved) return resolved;
    }
  }
  return resolveHttpAsset('/favicon.ico', baseUrl);
}

function resolveHttpAsset(value: string, baseUrl: URL): string | null {
  if (!value) return null;
  try {
    const asset = validatePublicUrl(new URL(value, baseUrl).toString());
    // The app is served over HTTPS in production, so insecure assets would be
    // blocked by browsers and can leak requests outside the secure context.
    return asset.protocol === 'https:' ? asset.toString() : null;
  } catch { return null; }
}

function cleanText(value: string, maxLength: number): string { return decodeEntities(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength); }
function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"', nbsp: ' ' };
  return value.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === '#') { const numeric = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10); return Number.isFinite(numeric) && numeric > 0 && numeric <= 0x10ffff ? String.fromCodePoint(numeric) : entity; }
    return named[code.toLowerCase()] ?? entity;
  });
}
function first(...values: Array<string | undefined>): string { return values.find((value) => Boolean(value?.trim()))?.trim() ?? ''; }
function isRedirect(status: number): boolean { return [301, 302, 303, 307, 308].includes(status); }
function isBlockedHostname(hostname: string): boolean {
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) return true;
  return !hostname.includes('.') && !hostname.includes(':');
}
function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.'); if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number); return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
}
function isPrivateIpv6(hostname: string): boolean {
  const host = hostname.toLowerCase(); return host === '::' || host === '::1' || host.startsWith('fc') || host.startsWith('fd') || /^fe[89ab]/.test(host) || host.startsWith('::ffff:127.') || host.startsWith('::ffff:10.') || host.startsWith('::ffff:192.168.');
}
