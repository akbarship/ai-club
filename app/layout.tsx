import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';
import '@/client/styles.css';

export const metadata: Metadata = { title: 'AI Club' };

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // telegram-web-app.js sets CSS variables on <html> before React hydrates.
    <html lang="uz" suppressHydrationWarning>
      <head>
        <meta name="format-detection" content="telephone=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Google+Sans+Code:wght@400;500&display=swap"
        />
      </head>
      <body>
        {/* Must load before the app: src/client/tg.ts reads window.Telegram when it is imported. */}
        <Script src="https://telegram.org/js/telegram-web-app.js?59" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
