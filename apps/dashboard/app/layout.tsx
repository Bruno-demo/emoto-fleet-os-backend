import type { Metadata } from 'next';
import { Manrope, Space_Grotesk } from 'next/font/google';
import { QueryProvider } from '@/components/providers/query-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import './globals.css';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'eMoto Fleet Dashboard',
  description: 'Fleet dashboard for live telematics operations',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

