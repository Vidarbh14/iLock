'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Laptop, KeyRound, History, Lock, Settings, Shield } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.email) {
          setUserEmail(data.user.email);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: Laptop },
    { href: '/devices', label: 'My Computers', icon: Laptop },
    { href: '/access', label: 'Grant Access', icon: KeyRound },
    { href: '/sessions', label: 'Sessions', icon: History },
    { href: '/security', label: 'Security & Audit', icon: ShieldCheck },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#08090d]/85 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Tag */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#0066ff] to-[#00d2ff] flex items-center justify-center text-white shadow-[0_0_20px_rgba(0,102,255,0.45)] group-hover:scale-105 transition-all">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-[#f0f3f6] flex items-center gap-2">
                iLock
                <span className="text-[9px] tracking-wider uppercase font-mono px-2 py-0.5 rounded-full bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/25">
                  COMMAND
                </span>
              </span>
              <span className="text-[10px] text-[#8b949e] font-mono leading-none">
                Zero-Knowledge Authorization
              </span>
            </div>
          </Link>

          {/* Desktop Navigation with Micro-Interactions (Requirement 10) */}
          <nav className="hidden md:flex items-center gap-1.5 ml-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#0066ff]/25 to-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/40 shadow-[0_0_15px_rgba(0,229,255,0.25)]'
                      : 'text-[#8b949e] hover:text-[#f0f3f6] hover:bg-white/[0.05] hover:border-white/[0.1] border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110" />
                  <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="w-1 h-1 rounded-full bg-[#00e5ff] shadow-[0_0_6px_#00e5ff] animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Side Status & User Profile */}
        <div className="flex items-center gap-2.5">
          {/* Cloud Active Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-[11px] font-mono text-[#8b949e]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981] shadow-[0_0_8px_#10b981]" />
            </span>
            <span>Cloud Active</span>
          </div>

          {/* Profile & Settings Button */}
          <Link
            href="/settings"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-[#00e5ff]/30 transition-all group"
            title={userEmail || 'Settings'}
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#0066ff] to-[#00e5ff] text-white flex items-center justify-center text-[10px] font-semibold uppercase shadow-[0_0_10px_rgba(0,102,255,0.4)]">
              {userEmail ? userEmail[0] : <Settings className="w-3 h-3" />}
            </div>
            <span className="hidden sm:inline text-xs font-mono font-medium text-[#f0f3f6] max-w-[130px] truncate">
              {userEmail ? (userEmail.includes('@') ? userEmail.split('@')[0] : userEmail) : 'Owner'}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
