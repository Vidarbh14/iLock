'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface TelemetryGaugeProps {
  label: string;
  value: number; // 0 to 100
  unit?: string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'cyan' | 'blue' | 'emerald' | 'amber' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  isAlert?: boolean;
}

export function TelemetryGauge({
  label,
  value,
  unit = '%',
  subtitle,
  icon: Icon,
  variant = 'cyan',
  size = 'md',
  isAlert = false,
}: TelemetryGaugeProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const variantStyles = {
    cyan: {
      stroke: '#00e5ff',
      glow: 'drop-shadow(0 0 6px rgba(0, 229, 255, 0.45))',
      text: 'text-[#00e5ff]',
      bgRing: 'stroke-[#00e5ff]/15',
      badge: 'bg-[#00e5ff]/10 text-[#00e5ff] border-[#00e5ff]/20',
    },
    blue: {
      stroke: '#0066ff',
      glow: 'drop-shadow(0 0 6px rgba(0, 102, 255, 0.45))',
      text: 'text-[#38bdf8]',
      bgRing: 'stroke-[#0066ff]/15',
      badge: 'bg-[#0066ff]/10 text-[#38bdf8] border-[#0066ff]/20',
    },
    emerald: {
      stroke: '#10b981',
      glow: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.45))',
      text: 'text-[#10b981]',
      bgRing: 'stroke-[#10b981]/15',
      badge: 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20',
    },
    amber: {
      stroke: '#f59e0b',
      glow: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.45))',
      text: 'text-[#f59e0b]',
      bgRing: 'stroke-[#f59e0b]/15',
      badge: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20',
    },
    purple: {
      stroke: '#a855f7',
      glow: 'drop-shadow(0 0 6px rgba(168, 85, 247, 0.45))',
      text: 'text-[#c084fc]',
      bgRing: 'stroke-[#a855f7]/15',
      badge: 'bg-[#a855f7]/10 text-[#c084fc] border-[#a855f7]/20',
    },
  }[variant];

  // Circular gauge calculations
  const radius = size === 'sm' ? 24 : size === 'lg' ? 38 : 30;
  const strokeWidth = size === 'sm' ? 4 : 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;
  const svgSize = (radius + strokeWidth) * 2;

  return (
    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.15] transition-all flex items-center justify-between gap-3 group">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${variantStyles.text}`} />
          <span className="text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider">
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold font-mono text-[#f0f3f6] tracking-tight">
            {clampedValue}
          </span>
          <span className="text-xs font-mono text-[#8b949e]">{unit}</span>
        </div>
        {subtitle && (
          <p className="text-[10px] text-[#8b949e] font-mono truncate max-w-[120px]">
            {subtitle}
          </p>
        )}
      </div>

      {/* SVG Radial Meter */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg width={svgSize} height={svgSize} className="-rotate-90">
          {/* Background Track */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="transparent"
            strokeWidth={strokeWidth}
            className={variantStyles.bgRing}
          />
          {/* Active Radial Progress */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="transparent"
            stroke={variantStyles.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ filter: variantStyles.glow, transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <span className="absolute text-[10px] font-mono font-semibold text-[#f0f3f6]">
          {Math.round(clampedValue)}%
        </span>
      </div>
    </div>
  );
}
