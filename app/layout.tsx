import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WaterChain — Evidence Investigation Workbench',
  description: 'An evidence-first workspace for investigating household drinking-water contamination pathways.',
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/favicon.svg', type: 'image/svg+xml' }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
