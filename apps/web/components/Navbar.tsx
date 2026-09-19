'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Laptop, KeyRound, History, Lock, Settings } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: Laptop },
    { href: '/devices', label: 'My Computers', icon: Laptop },
    { href: '/access', label: 'Grant Access', icon: KeyRound },
    { href: '/sessions', label: 'Sessions', icon: History },
    { href: '/security', label: 'Security & Audit', icon: ShieldCheck },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#0a0d14]/75 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-b from-white/20 via-white/10 to-transparent border border-white/20 flex items-center justify-center text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3)] group-hover:border-white/40 transition-all">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold tracking-tight text-[#f5f5f7] flex items-center gap-2">
                iLock
                <span className="text-[10px] tracking-wider uppercase font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-[#a1a1a6] border border-white/[0.1]">
                  Cloud
                </span>
              </span>
              <span className="text-[10px] text-[#86868b] leading-none">Remote Zero-Knowledge Access</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1.5 ml-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white/[0.12] text-white border border-white/[0.16] shadow-sm backdrop-blur-md'
                      : 'text-[#a1a1a6] hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Live System Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-[#a1a1a6] font-medium backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[#30d158] shadow-[0_0_8px_#30d158]" />
            Cloud Active
          </div>

          <Link
            href="/settings"
            className="p-2 rounded-xl text-[#a1a1a6] hover:text-white hover:bg-white/[0.08] border border-transparent hover:border-white/[0.1] transition-all"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
