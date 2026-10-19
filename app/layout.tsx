import Footer from '@components/Footer/Footer';
import Header from '@components/Header/Header';
import Navigation from '@components/Navigation/Navigation';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { getCurrentAccount } from '@/lib/session';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Pixelar',
  description: 'Your games, movies, and shows. One personal library.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico?v=3', sizes: '16x16 32x32 48x48', type: 'image/x-icon' },
      { url: '/favicon-gamepad-16.png?v=3', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-gamepad-32.png?v=3', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.ico?v=3',
    apple: [{ url: '/apple-icon.png?v=2', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Pixelar', statusBarStyle: 'default' },
};

export const viewport: Viewport = { themeColor: '#080d17' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const signedIn = Boolean(await getCurrentAccount());
  return (
    <html lang="en">
      <body className={signedIn ? 'signedIn' : undefined}>
        <a className="skipLink" href="#main">
          Skip to content
        </a>
        {signedIn ? <Navigation /> : <Header signedIn={false} />}
        <main id="main">{children}</main>
        <Footer signedIn={signedIn} />
      </body>
    </html>
  );
}
