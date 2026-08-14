import type { NextConfig } from 'next';

/**
 * CSP: die Karte lädt Tiles, Glyphs und DEM von externen Hosts. Genau diese
 * Hosts werden geöffnet, alles andere bleibt zu. `connect-src` deckt die
 * fetch-Aufrufe von MapLibre ab, `img-src` die Raster-Kacheln, `worker-src`
 * die MapLibre-Worker (blob:).
 */
const MAP_HOSTS = [
  'https://tiles.openfreemap.org', // Basiskarte
  'https://s3.amazonaws.com', // DEM: AWS Terrain Tiles
];
// Fotos aus Wikimedia Commons — nur Bilder, kein fetch.
const BILD_HOSTS = ['https://upload.wikimedia.org'];

const csp = [
  `default-src 'self'`,
  // Next injiziert Inline-Bootstrap-Skripte; 'unsafe-inline' ist dafür nötig.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${[...MAP_HOSTS, ...BILD_HOSTS].join(' ')}`,
  `font-src 'self' data:`,
  `connect-src 'self' ${MAP_HOSTS.join(' ')}`,
  `worker-src 'self' blob:`,
  `child-src blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
