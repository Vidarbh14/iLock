'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Laptop, KeyRound, History, ShieldCheck } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();

  const items = [
    { href: '/dashboard', label: 'Command', icon: LayoutDashboard },
    { href: '/devices', label: 'My PCs', icon: Laptop },
    { href: '/access', label: 'Grant', icon: KeyRound },
    { href: '/sessions', label: 'Sessions', icon: History },
    { href: '/security', label: 'Security', icon: ShieldCheck },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#08090d]/90 backdrop-blur-2xl pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 active:scale-95 ${
                isActive ? 'text-[#00e5ff] font-semibold' : 'text-[#8b949e] hover:text-[#f0f3f6]'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-[#00e5ff]/20 text-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.4)] scale-105 border border-[#00e5ff]/30'
                    : 'hover:bg-white/[0.05]'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] mt-1 font-mono tracking-tight flex items-center gap-1">
                {item.label}
                {isActive && <span className="w-1 h-1 rounded-full bg-[#00e5ff]" />}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
