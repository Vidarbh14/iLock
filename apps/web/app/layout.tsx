import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { AmbientBackground } from '@/components/AmbientBackground';
import { AppBootSplash } from '@/components/AppBootSplash';

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
        {/* Subtle Ambient Background Motion (Requirement 3) */}
        <AmbientBackground />

        {/* 750ms Initial Boot Sequence (Requirement 2) */}
        <AppBootSplash />

        {/* Top Navbar with Entry Animation & Micro-Interactions */}
        <div className="entry-seq-1">
          <Navbar />
        </div>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-14 z-10">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
