'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface Props {
  expiresAt?: string | null;
  expires_at?: string | null;
  totalDurationMinutes?: number;
  duration_minutes?: number;
  onExpire?: () => void;
  className?: string;
}

export function SessionCountdown({
  expiresAt,
  expires_at,
  totalDurationMinutes,
  duration_minutes,
  onExpire,
  className = '',
}: Props) {
  const effectiveExpiresAt = expiresAt || expires_at;
  const effectiveTotalMinutes = Number(totalDurationMinutes ?? duration_minutes ?? 15) || 15;

  const calculateRemainingMs = useCallback((): number => {
    if (!effectiveExpiresAt) {
      return effectiveTotalMinutes * 60 * 1000;
    }
    const targetTime = new Date(effectiveExpiresAt).getTime();
    if (isNaN(targetTime) || targetTime <= 0) {
      return effectiveTotalMinutes * 60 * 1000;
    }
    return Math.max(0, targetTime - Date.now());
  }, [effectiveExpiresAt, effectiveTotalMinutes]);

  const [timeLeftMs, setTimeLeftMs] = useState<number>(calculateRemainingMs);

  useEffect(() => {
    // Immediately synchronize on prop update
    setTimeLeftMs(calculateRemainingMs());

    const timer = setInterval(() => {
      const remaining = calculateRemainingMs();
      setTimeLeftMs(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateRemainingMs, onExpire]);

  // Safe arithmetic guards against NaN
  const safeTimeMs = isNaN(timeLeftMs) ? effectiveTotalMinutes * 60 * 1000 : timeLeftMs;
  const totalSeconds = Math.max(0, Math.floor(safeTimeMs / 1000));
  const rawMinutes = Math.floor(totalSeconds / 60);
  const rawSeconds = totalSeconds % 60;

  const minutes = isNaN(rawMinutes) ? effectiveTotalMinutes : rawMinutes;
  const seconds = isNaN(rawSeconds) ? 0 : rawSeconds;

  const totalMs = Math.max(1000, effectiveTotalMinutes * 60 * 1000);
  const progressPct = Math.min(100, Math.max(0, (safeTimeMs / totalMs) * 100));

  let colorClass = 'text-emerald-400';
  let barColor = 'bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]';

  if (minutes < 3) {
    colorClass = 'text-rose-400 animate-pulse';
    barColor = 'bg-gradient-to-r from-rose-500 to-pink-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]';
  } else if (minutes < 10) {
    colorClass = 'text-amber-400';
    barColor = 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]';
  }

  if (safeTimeMs <= 0) {
    return (
      <div className={`font-mono text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400 inline-flex items-center gap-1.5 animate-fade-in ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500/70" />
        EXPIRED
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400 flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${minutes < 3 ? 'bg-rose-400 animate-ping' : minutes < 10 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          Time Remaining:
        </span>
        <span className={`font-mono font-bold tracking-widest text-sm transition-colors duration-500 ${colorClass}`}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
      <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-1000 ease-linear rounded-full`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
