'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  expiresAt: string;
  totalDurationMinutes?: number;
  onExpire?: () => void;
  className?: string;
}

export function SessionCountdown({ expiresAt, totalDurationMinutes = 30, onExpire, className = '' }: Props) {
  const [timeLeftMs, setTimeLeftMs] = useState<number>(() => {
    return Math.max(0, new Date(expiresAt).getTime() - Date.now());
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setTimeLeftMs(remaining);
      if (remaining === 0) {
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  const totalSeconds = Math.floor(timeLeftMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const totalMs = totalDurationMinutes * 60 * 1000;
  const progressPct = Math.min(100, Math.max(0, (timeLeftMs / totalMs) * 100));

  let colorClass = 'text-[#10b981]';
  let barColor = 'bg-gradient-to-r from-[#10b981] to-[#00e5ff] shadow-[0_0_12px_rgba(16,185,129,0.5)]';

  if (minutes < 5) {
    colorClass = 'text-[#fb7185] animate-pulse';
    barColor = 'bg-[#f43f5e] shadow-[0_0_12px_rgba(244,63,94,0.6)]';
  } else if (minutes < 15) {
    colorClass = 'text-[#fbbf24]';
    barColor = 'bg-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.5)]';
  }

  if (timeLeftMs === 0) {
    return (
      <div className={`font-mono text-xs font-semibold text-[#8b949e] ${className}`}>
        EXPIRED
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-[#8b949e]">Time Remaining:</span>
        <span className={`font-mono font-bold tracking-widest text-sm ${colorClass}`}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
      <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-1000 rounded-full`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
