'use client';

import React from 'react';

export function AmbientBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden -z-20 select-none"
      aria-hidden="true"
    >
      {/* Drifting Ambient Chromatic Orbs */}
      {/* 1. Top Electric Blue / Cyan Glow */}
      <div className="absolute -top-[15%] left-[20%] w-[550px] h-[550px] rounded-full bg-gradient-to-br from-[#0066ff]/14 to-[#00e5ff]/8 blur-[130px] animate-ambient-drift-slow" />

      {/* 2. Center-Right Purple Cyber-Atmosphere Glow */}
      <div className="absolute top-[35%] -right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-[#8b5cf6]/10 to-[#3b82f6]/6 blur-[140px] animate-ambient-drift-rev" />

      {/* 3. Bottom-Left Emerald Security Glow */}
      <div className="absolute -bottom-[15%] left-[5%] w-[480px] h-[480px] rounded-full bg-gradient-to-tr from-[#10b981]/8 to-[#00e5ff]/5 blur-[120px] animate-ambient-drift-slow" />

      {/* Very faint SVG network nodes / cyber constellation */}
      <svg
        className="absolute inset-0 w-full h-full opacity-25"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0066ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Faint connecting conduits */}
        <line
          x1="12%"
          y1="22%"
          x2="35%"
          y2="14%"
          stroke="rgba(0, 229, 255, 0.08)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />
        <line
          x1="35%"
          y1="14%"
          x2="68%"
          y2="28%"
          stroke="rgba(0, 229, 255, 0.06)"
          strokeWidth="1"
          strokeDasharray="3 5"
        />
        <line
          x1="68%"
          y1="28%"
          x2="88%"
          y2="18%"
          stroke="rgba(139, 92, 246, 0.08)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />
        <line
          x1="18%"
          y1="75%"
          x2="48%"
          y2="82%"
          stroke="rgba(16, 185, 129, 0.06)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />
        <line
          x1="48%"
          y1="82%"
          x2="82%"
          y2="68%"
          stroke="rgba(0, 229, 255, 0.06)"
          strokeWidth="1"
          strokeDasharray="3 5"
        />

        {/* Subtle Constellation Nodes */}
        <circle cx="12%" cy="22%" r="2" fill="#00e5ff" opacity="0.4" className="animate-pulse" />
        <circle cx="35%" cy="14%" r="2.5" fill="#0066ff" opacity="0.5" />
        <circle cx="68%" cy="28%" r="2" fill="#8b5cf6" opacity="0.4" className="animate-pulse" />
        <circle cx="88%" cy="18%" r="3" fill="#00e5ff" opacity="0.3" />
        <circle cx="18%" cy="75%" r="2" fill="#10b981" opacity="0.35" />
        <circle cx="48%" cy="82%" r="2.5" fill="#00e5ff" opacity="0.4" className="animate-pulse" />
        <circle cx="82%" cy="68%" r="2" fill="#8b5cf6" opacity="0.3" />
      </svg>
    </div>
  );
}
