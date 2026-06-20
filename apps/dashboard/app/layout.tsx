import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import { QueryProvider } from '@/components/providers/query-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { LanguageProvider } from '@/components/i18n/LanguageProvider';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: true,
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: {
    default: 'eMoto Fleet OS | Smart Safety & Telematics Command Center',
    template: '%s | eMoto Fleet OS',
  },
  description: 'Real-time safety, tracking, and B2B SaaS operations management for electric motorcycle fleets in Kigali, Rwanda. Automate leasing, protect vehicle assets, and increase rider safety.',
  keywords: [
    'e-moto Rwanda',
    'electric motorcycle Kigali',
    'motorcycle taxi GPS tracking',
    'Kigali logistics tracking',
    'electric bike lease-to-own',
    'Rwanda IoT telematics',
    'e-moto fleet management',
    'vehicle immobilization Kigali',
    'SinoTrack Kigali configuration',
    'eMoto Fleet OS',
  ],
  authors: [{ name: 'eMoto Team', url: 'https://emotofleet.com' }],
  creator: 'eMoto',
  metadataBase: new URL('https://emotofleet.com'),
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-96.png', type: 'image/png', sizes: '96x96' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://emotofleet.com',
    title: 'eMoto Fleet OS | Smart Safety & Telematics Command Center',
    description: 'Real-time safety, tracking, and B2B SaaS operations management for electric motorcycle fleets in Kigali, Rwanda.',
    siteName: 'eMoto Fleet OS',
    images: [
      {
        url: '/icon.svg',
        width: 512,
        height: 512,
        alt: 'eMoto Fleet OS Command Center',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'eMoto Fleet OS | Smart Safety & Telematics Command Center',
    description: 'Real-time safety, tracking, and B2B SaaS operations management for electric motorcycle fleets in Kigali, Rwanda.',
    images: ['/icon.svg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              'name': 'eMoto Fleet OS',
              'operatingSystem': 'All',
              'applicationCategory': 'BusinessApplication',
              'description': 'Real-time safety, telematics, and operations management platform for electric motorcycle fleets in Kigali, Rwanda.',
              'offers': {
                '@type': 'Offer',
                'price': '5000',
                'priceCurrency': 'RWF',
                'description': 'Safety Core subscription'
              },
              'publisher': {
                '@type': 'Organization',
                'name': 'eMoto',
                'url': 'https://emotofleet.com'
              }
            }),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function isExtensionError(e) {
                  if (!e) return false;
                  const filename = e.filename || '';
                  const message = e.message || '';
                  const stack = e.stack || '';
                  return (
                    filename.indexOf('chrome-extension://') !== -1 ||
                    stack.indexOf('chrome-extension://') !== -1 ||
                    message.indexOf('MetaMask') !== -1 ||
                    message.indexOf('metaMask') !== -1
                  );
                }
                window.addEventListener('error', function(event) {
                  if (isExtensionError(event) || isExtensionError(event.error)) {
                    event.stopImmediatePropagation();
                    event.preventDefault();
                  }
                }, true);
                window.addEventListener('unhandledrejection', function(event) {
                  if (isExtensionError(event) || isExtensionError(event.reason)) {
                    event.stopImmediatePropagation();
                    event.preventDefault();
                  }
                }, true);
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${manrope.variable} ${spaceGrotesk.variable} min-h-screen antialiased`}
      >
        <ThemeProvider>
          <LanguageProvider>
            <QueryProvider>
              {children}
              <SpeedInsights />
              <Analytics />
            </QueryProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

