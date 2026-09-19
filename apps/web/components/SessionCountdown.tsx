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

  // Color styling based on remaining duration
  let colorClass = 'text-[#30d158]';
  let barColor = 'bg-[#30d158]';

  if (minutes < 5) {
    colorClass = 'text-[#ff6961] animate-pulse';
    barColor = 'bg-[#ff453a]';
  } else if (minutes < 15) {
    colorClass = 'text-[#ff9f0a]';
    barColor = 'bg-[#ff9f0a]';
  }

  if (timeLeftMs === 0) {
    return (
      <div className={`font-mono text-xs font-semibold text-slate-500 ${className}`}>
        EXPIRED
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">Time Remaining:</span>
        <span className={`font-mono font-semibold tracking-wider ${colorClass}`}>
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
