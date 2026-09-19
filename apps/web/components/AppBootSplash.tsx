'use client';

import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, Zap } from 'lucide-react';

export function AppBootSplash() {
  const [stage, setStage] = useState<'hidden' | 'logo' | 'connecting' | 'connected' | 'done'>('hidden');

  useEffect(() => {
    // Only play boot splash once per browser session
    try {
      if (sessionStorage.getItem('ilock_boot_played') === 'true') {
        setStage('done');
        return;
      }
    } catch {
      // Ignore storage restrictions
    }

    // Fast 750ms orchestrated initialization sequence
    setStage('logo');

    const t1 = setTimeout(() => {
      setStage('connecting');
    }, 220);

    const t2 = setTimeout(() => {
      setStage('connected');
    }, 520);

    const t3 = setTimeout(() => {
      setStage('done');
      try {
        sessionStorage.setItem('ilock_boot_played', 'true');
      } catch {}
    }, 780);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (stage === 'done' || stage === 'hidden') {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#08090d] transition-opacity duration-300 pointer-events-none ${
        stage === 'connected' ? 'opacity-0' : 'opacity-100'
      }`}
      aria-hidden="true"
    >
      {/* Background ambient pulse */}
      <div className="absolute w-72 h-72 rounded-full bg-[#0066ff]/20 blur-[90px] animate-pulse" />

      {/* Main Core Animation Box */}
      <div className="relative flex flex-col items-center gap-4 text-center">
        {/* Emblem Shield with Expanding Ring */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-20 h-20 rounded-full border border-[#00e5ff]/30 animate-ping opacity-40" />
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#0066ff] to-[#00e5ff] flex items-center justify-center text-white shadow-[0_0_35px_rgba(0,102,255,0.6)] transform scale-100 transition-transform duration-300">
            <Lock className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Brand & Stage Text */}
        <div className="space-y-1">
          <div className="text-xl font-bold tracking-tight text-[#f0f3f6] flex items-center justify-center gap-2">
            <span>iLock</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30">
              COMMAND
            </span>
          </div>

          <div className="h-5 flex items-center justify-center text-xs font-mono">
            {stage === 'logo' && (
              <span className="text-slate-400 opacity-80 animate-pulse">INITIALIZING CORE...</span>
            )}
            {stage === 'connecting' && (
              <span className="text-[#00e5ff] flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 animate-bounce" />
                ESTABLISHING SECURE CONDUIT...
              </span>
            )}
            {stage === 'connected' && (
              <span className="text-[#10b981] flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                CLOUD CONNECTED
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
