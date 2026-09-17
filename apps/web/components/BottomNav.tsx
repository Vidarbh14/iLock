'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Laptop, KeyRound, History, ShieldCheck } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();

  const items = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/devices', label: 'My PCs', icon: Laptop },
    { href: '/access', label: 'Grant', icon: KeyRound },
    { href: '/sessions', label: 'Sessions', icon: History },
    { href: '/security', label: 'Security', icon: ShieldCheck },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-lg pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive ? 'text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive ? 'bg-cyan-500/15 text-cyan-400 scale-110' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
