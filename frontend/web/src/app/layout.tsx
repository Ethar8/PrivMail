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
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
