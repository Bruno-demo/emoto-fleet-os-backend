import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: [
        '/',
        '/about',
        '/blog',
        '/careers',
        '/compliance',
        '/contact',
        '/docs',
        '/privacy',
        '/security',
        '/terms',
        '/rider-app',
      ],
      disallow: [
        '/overview',
        '/live',
        '/bikes',
        '/riders',
        '/incidents',
        '/events',
        '/trips',
        '/zones',
        '/reports',
        '/settings',
        '/financial',
        '/checkout',
        '/create-account',
        '/login',
        '/reset-password',
        '/forgot-password',
        '/hq/',
      ],
    },
    sitemap: 'https://emotofleet.com/sitemap.xml',
  };
}
