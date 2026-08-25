# MetaCard

MetaCard is a full-stack MVP that turns a public webpage URL into normalized metadata and a responsive preview card.

## Request flow

```text
React form → POST /api/metadata → validated target URL → bounded HTML fetch
           ← normalized JSON      ← metadata parser     ← public webpage
           → accessible preview card
```

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. A production build is created with `npm run build`.

## API contract

`POST /api/metadata` with `Content-Type: application/json`:

```json
{ "url": "https://example.com" }
```

Success returns `url`, `finalUrl`, `title`, `description`, `image`, `siteName`, `favicon`, `type`, and `fetchedAt`. Errors use a stable shape:

```json
{ "error": { "code": "INVALID_URL", "message": "…", "requestId": "…" } }
```

## MVP safeguards

- Only public HTTP(S) targets on standard ports are accepted. Credentials, localhost, IP literals in private/reserved ranges, and private hostname suffixes are rejected.
- Every redirect is manually revalidated. Fetches time out after eight seconds, stop after three redirects, and read at most 1 MB of HTML.
- Only HTML responses are parsed. Metadata is decoded, whitespace-normalized, length-bounded, and returned as JSON rather than injected as HTML.
- Remote card images are restricted to validated HTTPS URLs and load without a referrer. API responses include request IDs and defensive headers.
- A per-instance fixed-window rate limit and five-minute bounded cache protect the MVP without adding a database dependency.
- The app is stateless and edge-deployable. For sustained multi-region traffic, replace the in-memory limiter/cache with Cloudflare Rate Limiting and Cache API, KV, or a Durable Object, and add metrics around latency, cache hit rate, upstream failures, and blocked SSRF attempts.

## Production evolution

The parser and transport are deliberately isolated in `lib/metadata.ts`, while the HTTP contract lives in `app/api/metadata/route.ts`. This keeps the UI independent and makes it straightforward to move extraction to a queue for slow pages, add a durable cache keyed by canonical URL, or split the API into its own service without changing the card component.
