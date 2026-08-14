import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Island 2026 — Rund um die Insel',
  description: 'Karte zum Reiseplan „Rund um die Insel" (27.08.–10.09.2026).',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#eaf1f6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
