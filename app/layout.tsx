import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || 'http://localhost:3000'),
  title: 'MetaCard — URL metadata previews',
  description: 'Safely turn any public webpage into clean, useful metadata.',
  openGraph: {
    title: 'MetaCard — URL metadata previews',
    description: 'Turn any webpage into a clean, useful card.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'MetaCard link preview generator' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MetaCard — URL metadata previews',
    description: 'Turn any webpage into a clean, useful card.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
