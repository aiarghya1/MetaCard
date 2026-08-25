'use client';

import { FormEvent, useState } from 'react';

type MetadataResult = {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  image: string | null;
  siteName: string;
  favicon: string | null;
  type: string;
  fetchedAt: string;
};

type ApiError = { error?: { message?: string } };
const EXAMPLE_URL = 'https://stripe.com';

export default function Home() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<MetadataResult | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResult(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const payload = (await response.json()) as MetadataResult & ApiError;
      if (!response.ok) throw new Error(payload.error?.message || 'We could not read that page.');
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main>
      <nav className="nav shell" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="MetaCard home">
          <span className="brand-mark" aria-hidden="true">M</span><span>MetaCard</span>
        </a>
        <span className="status-pill"><span /> API ready</span>
      </nav>

      <section className="hero shell" id="top">
        <div className="eyebrow"><span>↗</span> URL metadata, made useful</div>
        <h1>Turn any webpage into<br /><em>a clean, useful card.</em></h1>
        <p className="hero-copy">Paste a public URL. We safely fetch its metadata, normalize the response, and render a polished preview in seconds.</p>

        <form className="url-form" onSubmit={handleSubmit} aria-label="Generate metadata card">
          <label htmlFor="url">Webpage URL</label>
          <div className="input-row">
            <span className="link-icon" aria-hidden="true">⌁</span>
            <input id="url" name="url" type="url" inputMode="url" autoComplete="url" placeholder="https://example.com/article" value={url} onChange={(event) => setUrl(event.target.value)} required aria-describedby="url-help" />
            <button type="submit" disabled={isLoading}>{isLoading ? 'Fetching…' : 'Generate card'}<span aria-hidden="true">→</span></button>
          </div>
          <div className="form-meta" id="url-help">
            <span>Try an example:</span>
            <button type="button" className="example" onClick={() => setUrl(EXAMPLE_URL)}>{EXAMPLE_URL}</button>
            <span className="privacy">No page content is stored</span>
          </div>
        </form>

        <div className="result-region" aria-live="polite" aria-busy={isLoading}>
          {isLoading && <LoadingCard />}
          {error && <div className="error-card" role="alert"><span>!</span><p><strong>Couldn’t generate a card</strong>{error}</p></div>}
          {result && <MetadataCard result={result} />}
          {!isLoading && !error && !result && <DemoCard />}
        </div>
      </section>

      <section className="process shell" aria-labelledby="process-title">
        <div><p className="section-kicker">Simple by design</p><h2 id="process-title">One URL. Three quick steps.</h2></div>
        <ol>
          <li><span>01</span><div><strong>Paste</strong><p>Enter any public webpage URL.</p></div></li>
          <li><span>02</span><div><strong>Parse</strong><p>We safely extract and normalize its metadata.</p></div></li>
          <li><span>03</span><div><strong>Preview</strong><p>Get a share-ready card instantly.</p></div></li>
        </ol>
      </section>

      <footer className="shell"><span>MetaCard</span><p>Built for fast, safe link previews.</p></footer>
    </main>
  );
}

function MetadataCard({ result }: { result: MetadataResult }) {
  const host = new URL(result.finalUrl).hostname.replace(/^www\./, '');
  return (
    <article className="preview-card generated">
      <div className="preview-image">
        {/* Arbitrary remote hosts cannot safely be allow-listed for Next Image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {result.image ? <img src={result.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <div className="image-fallback"><span>↗</span></div>}
        <span className="live-badge">Live metadata</span>
      </div>
      <div className="preview-content">
        <div className="site-line">{result.favicon ? <RemoteFavicon src={result.favicon} /> : <span className="tiny-mark">M</span>}<span>{result.siteName || host}</span><span className="dot">·</span><span>{host}</span></div>
        <h2>{result.title}</h2>
        <p>{result.description || 'No description was provided by this page.'}</p>
        <a href={result.finalUrl} target="_blank" rel="noopener noreferrer">Open webpage <span>↗</span></a>
      </div>
    </article>
  );
}

function RemoteFavicon({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width="20" height="20" loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
}

function DemoCard() {
  return (
    <article className="preview-card demo" aria-label="Example metadata card">
      <div className="preview-image demo-art" aria-hidden="true"><div className="orb one" /><div className="orb two" /><div className="demo-logo">M</div><span className="sample-badge">Example preview</span></div>
      <div className="preview-content">
        <div className="site-line"><span className="tiny-mark">M</span><span>MetaCard</span><span className="dot">·</span><span>metacard.app</span></div>
        <h2>Beautiful metadata previews, without the busywork.</h2>
        <p>Your generated result will appear right here—complete with the page title, description, image, and source.</p>
        <span className="demo-link">Your result will appear here <span>↑</span></span>
      </div>
    </article>
  );
}

function LoadingCard() {
  return <div className="preview-card loading-card" role="status"><div className="skeleton image-skeleton" /><div className="preview-content"><div className="skeleton line short" /><div className="skeleton line title" /><div className="skeleton line" /><div className="skeleton line medium" /></div></div>;
}
