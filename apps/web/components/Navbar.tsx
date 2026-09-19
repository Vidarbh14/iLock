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
    <header className="sticky top-0 z-40 w-full border-b border-black/[0.06] bg-white/80 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-2xl bg-[#0071e3] flex items-center justify-center text-white shadow-[0_2px_8px_rgba(0,113,227,0.3)] group-hover:scale-105 transition-all">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold tracking-tight text-[#1d1d1f] flex items-center gap-2">
                iLock
                <span className="text-[10px] tracking-wider uppercase font-mono px-2 py-0.5 rounded-full bg-black/[0.05] text-[#6e6e73] border border-black/[0.08]">
                  Cloud
                </span>
              </span>
              <span className="text-[10px] text-[#6e6e73] leading-none">Remote Zero-Knowledge Access</span>
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
                      ? 'bg-[#0071e3] text-white shadow-sm'
                      : 'text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.04]'
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
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-black/[0.04] border border-black/[0.06] text-[11px] text-[#6e6e73] font-medium backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34c759] shadow-[0_0_6px_#34c759]" />
            Cloud Active
          </div>

          <Link
            href="/settings"
            className="p-2 rounded-full text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.05] transition-all"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
