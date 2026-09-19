'use client';

import React from 'react';

interface CornerOrbProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  variant?: 'cyan' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  pulse?: boolean;
  className?: string;
}

export function CornerOrb({
  position = 'top-right',
  variant = 'cyan',
  size = 'md',
  active = false,
  pulse = false,
  className = '',
}: CornerOrbProps) {
  const isGlowing = active || pulse;
  const positionClasses = {
    'top-right': '-top-2 -right-2',
    'top-left': '-top-2 -left-2',
    'bottom-right': '-bottom-2 -right-2',
    'bottom-left': '-bottom-2 -left-2',
  }[position];

  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
  }[size];

  const glowSizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  }[size];

  const colorConfig = {
    cyan: {
      core: 'from-[#00e5ff] to-[#0070f3]',
      border: 'border-[#00e5ff]/60',
      glow: 'bg-[#00e5ff]/20',
      shadow: 'shadow-[0_0_12px_rgba(0,229,255,0.6)]',
    },
    blue: {
      core: 'from-[#0070f3] to-[#4f46e5]',
      border: 'border-[#0070f3]/60',
      glow: 'bg-[#0070f3]/25',
      shadow: 'shadow-[0_0_12px_rgba(0,112,243,0.6)]',
    },
    emerald: {
      core: 'from-[#10b981] to-[#059669]',
      border: 'border-[#10b981]/60',
      glow: 'bg-[#10b981]/25',
      shadow: 'shadow-[0_0_12px_rgba(16,185,129,0.6)]',
    },
    amber: {
      core: 'from-[#f59e0b] to-[#d97706]',
      border: 'border-[#f59e0b]/60',
      glow: 'bg-[#f59e0b]/25',
      shadow: 'shadow-[0_0_12px_rgba(245,158,11,0.6)]',
    },
    rose: {
      core: 'from-[#f43f5e] to-[#e11d48]',
      border: 'border-[#f43f5e]/60',
      glow: 'bg-[#f43f5e]/25',
      shadow: 'shadow-[0_0_12px_rgba(244,63,94,0.6)]',
    },
    purple: {
      core: 'from-[#a855f7] to-[#7c3aed]',
      border: 'border-[#a855f7]/60',
      glow: 'bg-[#a855f7]/25',
      shadow: 'shadow-[0_0_12px_rgba(168,85,247,0.6)]',
    },
  }[variant];

  return (
    <div
      className={`absolute ${positionClasses} pointer-events-none z-10 flex items-center justify-center transition-all duration-500 ease-out group-hover:scale-115 ${className}`}
      aria-hidden="true"
    >
      {/* Active Expansion Ring (Requirement 4: On active interaction, ring appears) */}
      {isGlowing && (
        <div
          className={`absolute rounded-full border border-current ${glowSizeClasses} ${colorConfig.border} animate-ping opacity-30 duration-1000`}
        />
      )}

      {/* Ambient Atmospheric Blur Halo */}
      <div
        className={`absolute rounded-full blur-md ${glowSizeClasses} ${colorConfig.glow} transition-all duration-700 ${
          isGlowing ? 'scale-130 opacity-90' : 'scale-100 opacity-60'
        } group-hover:opacity-100 group-hover:scale-140`}
      />

      {/* Floating Orb Core with subtle scale & opacity breathing */}
      <div
        className={`relative rounded-full bg-gradient-to-br ${colorConfig.core} border ${colorConfig.border} ${colorConfig.shadow} ${sizeClasses} transition-all duration-500 animate-orb-float group-hover:shadow-[0_0_20px_rgba(0,229,255,0.8)]`}
      >
        {/* Specular Highlight */}
        <div className="absolute top-0.5 left-0.5 w-1/3 h-1/3 rounded-full bg-white/75 blur-[0.4px]" />
      </div>
    </div>
  );
}
