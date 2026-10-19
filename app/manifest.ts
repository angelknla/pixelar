import type { MetadataRoute } from 'next';

const manifest = (): MetadataRoute.Manifest => {
  return {
    id: '/',
    name: 'Pixelar',
    short_name: 'Pixelar',
    description: 'Your games, movies, and shows. One personal library.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#080d17',
    theme_color: '#080d17',
    icons: [
      { src: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
};

export default manifest;
