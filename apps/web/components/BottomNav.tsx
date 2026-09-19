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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0a0d14]/85 backdrop-blur-2xl pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                isActive ? 'text-white font-medium' : 'text-[#86868b] hover:text-[#f5f5f7]'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive ? 'bg-white/[0.12] text-white border border-white/[0.14] shadow-sm' : ''
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
