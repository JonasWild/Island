import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Island 2026 — Rund um die Insel',
  description:
    'Karten-App zum Reiseplan „Rund um die Insel“ (27.08.–10.09.2026): 15 Tage, 128 Stopps, 3D-Terrain.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="h-full overflow-hidden bg-slate-950">{children}</body>
    </html>
  );
}
