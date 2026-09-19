import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'iLock — Zero-Knowledge Cybersecurity Command Center',
  description:
    'Cryptographic zero-knowledge workstation authorization and remote PC security console for Windows from any device.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'iLock',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#08090d',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full dark">
      <body className="bg-[#08090d] text-[#f0f3f6] min-h-full flex flex-col font-sans antialiased selection:bg-[#00e5ff]/25 selection:text-[#00e5ff] relative overflow-x-hidden bg-cyber-grid">
        {/* Ambient Atmospheric Lights */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[#0066ff]/12 via-[#00e5ff]/6 to-transparent blur-[120px] pointer-events-none -z-10" />
        <div className="fixed bottom-0 right-0 w-[500px] h-[300px] bg-gradient-to-tl from-[#8b5cf6]/10 to-transparent blur-[140px] pointer-events-none -z-10" />

        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-14 z-10">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
