# MetaCard

> Turn any public webpage URL into a clean, useful metadata card.

MetaCard is a full-stack web application that fetches, normalizes, and previews Open Graph and meta tag data from any public URL. Paste a link, get a polished preview card — perfect for social sharing validation, content auditing, or building link preview features.

![MetaCard](public/og.png)

---

## ✨ Features

- **Instant Metadata Extraction** — Fetches `og:title`, `og:description`, `og:image`, favicon, site name, and more from any public URL
- **Live Preview Card** — Renders a responsive, share-ready card from the extracted metadata
- **SSRF Protection** — Blocks private IPs, localhost, non-standard ports, and credential-bearing URLs
- **Redirect Handling** — Follows up to 3 redirects with re-validation at each hop
- **Rate Limiting** — Built-in per-client fixed-window rate limiter (30 req/min)
- **In-Memory Cache** — 5-minute TTL cache to avoid redundant upstream fetches
- **Edge-Ready API** — Stateless design, runs on the edge runtime
- **Accessible UI** — Semantic HTML, ARIA attributes, keyboard-navigable, and reduced-motion support
- **Responsive Design** — Works beautifully on desktop and mobile

---

## 🏗️ Architecture

```text
React form → POST /api/metadata → URL validation → bounded HTML fetch
           ← normalized JSON      ← metadata parser ← public webpage
           → accessible preview card
```

| Layer | File | Responsibility |
|-------|------|---------------|
| **UI** | `app/page.tsx` | Client-side form, preview card, loading/error states |
| **Layout** | `app/layout.tsx` | Root layout, fonts, SEO metadata |
| **API Route** | `app/api/metadata/route.ts` | Request validation, rate limiting, caching, error handling |
| **Core Library** | `lib/metadata.ts` | URL validation, HTML fetching, metadata parsing, SSRF protection |
| **Styles** | `app/globals.css` | Complete design system with responsive breakpoints |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 22.13.0
- **npm** (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/aiarghya1/MetaCard.git
cd MetaCard

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm run start
```

---

## 📡 API Reference

### `POST /api/metadata`

Extracts metadata from a public webpage URL.

**Request:**

```json
{
  "url": "https://stripe.com"
}
```

**Headers:** `Content-Type: application/json`

**Success Response (200):**

```json
{
  "url": "https://stripe.com",
  "finalUrl": "https://stripe.com/",
  "title": "Stripe | Financial Infrastructure for the Internet",
  "description": "Stripe powers online and in-person payment processing...",
  "image": "https://images.stripeassets.com/...",
  "siteName": "Stripe",
  "favicon": "https://stripe.com/favicon.ico",
  "type": "website",
  "fetchedAt": "2025-01-01T00:00:00.000Z"
}
```

**Error Response:**

```json
{
  "error": {
    "code": "INVALID_URL",
    "message": "Enter a valid public webpage URL.",
    "requestId": "uuid"
  }
}
```

**Error Codes:**

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_URL` | 400 | Malformed or empty URL |
| `UNSAFE_URL` | 400 | Private/local network address |
| `INVALID_JSON` | 400 | Malformed request body |
| `PAYLOAD_TOO_LARGE` | 413 | Request body > 2.5 KB |
| `UNSUPPORTED_CONTENT` | 415 | URL does not point to HTML |
| `TOO_MANY_REDIRECTS` | 422 | More than 3 redirects |
| `UPSTREAM_ERROR` | 422 | Target returned non-2xx status |
| `RATE_LIMITED` | 429 | Exceeded 30 requests/minute |
| `FETCH_TIMEOUT` | 504 | Target did not respond within 8s |
| `FETCH_FAILED` | 502 | Target unreachable |

### `GET /api/metadata`

Returns API information and usage example.

---

## 🔒 Security

- **SSRF Protection** — Rejects private IPs (10.x, 172.16–31.x, 192.168.x, 127.x, link-local), IPv6 loopback/ULA, `.local`/`.internal` hostnames, and non-standard ports
- **Input Validation** — URL length capped at 2048 chars, request body at 2.5 KB
- **Bounded Fetches** — HTML response limited to 1 MB, 8-second timeout
- **Redirect Re-Validation** — Each redirect hop is validated against the same SSRF rules
- **Security Headers** — `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`, `X-Frame-Options`, `Permissions-Policy`
- **No Content Storage** — Metadata is extracted and returned; no page content is stored

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) with App Router
- **Runtime:** Edge Runtime
- **Build Tool:** [Vite 8](https://vite.dev/) via [Vinext](https://vinext.dev/)
- **Language:** TypeScript 5.9
- **Styling:** Tailwind CSS 4.2 + Custom CSS
- **Fonts:** [Geist](https://vercel.com/font) (Sans + Mono)

---

## 📁 Project Structure

```
MetaCard/
├── app/
│   ├── api/
│   │   └── metadata/
│   │       └── route.ts       # API endpoint
│   ├── globals.css            # Design system & styles
│   ├── layout.tsx             # Root layout & SEO
│   └── page.tsx               # Main UI page
├── lib/
│   └── metadata.ts            # Core metadata extraction logic
├── public/
│   ├── favicon.svg            # App favicon
│   └── og.png                 # Open Graph image
├── next.config.ts             # Next.js configuration
├── vite.config.ts             # Vite build configuration
├── tsconfig.json              # TypeScript configuration
├── eslint.config.mjs          # ESLint configuration
└── package.json               # Dependencies & scripts
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
