import type { Metadata } from 'next';
import './globals.css';
import '../styles/themes.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'PrivMail – Sichere E-Mails',
  description:
    'PrivMail – Ihre sichere, selbst-gehostete E-Mail-Plattform mit Ende-zu-Ende-Verschlüsselung',
  keywords: 'E-Mail, Verschlüsselung, OpenPGP, Privatsphäre, Self-Hosting',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16.png', type: 'image/png', sizes: '16x16' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'PrivMail – Sichere E-Mails',
    description: 'Selbst-gehostete E-Mail-Plattform mit Ende-zu-Ende-Verschlüsselung',
    images: ['/og-image.png'],
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
  <head>
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#4f46e5" />
  </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:shadow"
        >
          Zum Inhalt springen
        </a>
        <Providers>
          <div id="main-content">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
