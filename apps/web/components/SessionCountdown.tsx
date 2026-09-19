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
  let colorClass = 'text-[#248a3d]';
  let barColor = 'bg-[#34c759]';

  if (minutes < 5) {
    colorClass = 'text-[#ff3b30] animate-pulse';
    barColor = 'bg-[#ff3b30]';
  } else if (minutes < 15) {
    colorClass = 'text-[#ff9500]';
    barColor = 'bg-[#ff9500]';
  }

  if (timeLeftMs === 0) {
    return (
      <div className={`font-mono text-xs font-semibold text-[#86868b] ${className}`}>
        EXPIRED
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#6e6e73]">Time Remaining:</span>
        <span className={`font-mono font-semibold tracking-wider ${colorClass}`}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
      <div className="w-full h-1.5 bg-black/[0.07] rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-1000 rounded-full`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
