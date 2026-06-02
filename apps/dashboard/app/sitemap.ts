import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://emotofleet.com';
  const publicRoutes = [
    '',
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
  ];

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' || route === '/blog' ? 'daily' : 'weekly',
    priority: route === '' ? 1.0 : route === '/rider-app' || route === '/about' ? 0.8 : 0.5,
  }));
}
