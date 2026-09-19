'use client';

import React from 'react';
import { Smartphone, Cloud, Cpu, Laptop, ShieldCheck, Lock, Unlock, Zap } from 'lucide-react';

interface ConnectionVisualizerProps {
  deviceOnline?: boolean;
  isWorkstationLocked?: boolean;
  deviceName?: string;
  isTransacting?: boolean;
  className?: string;
}

export function ConnectionVisualizer({
  deviceOnline = true,
  isWorkstationLocked = false,
  deviceName = 'Windows PC',
  isTransacting = false,
  className = '',
}: ConnectionVisualizerProps) {
  return (
    <div className={`glass-card p-5 rounded-3xl relative overflow-hidden border border-white/[0.08] ${className}`}>
      {/* Background glow lines */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff] animate-pulse" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#00e5ff] font-semibold">
            Zero-Knowledge Cryptographic Conduit
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono text-[#8b949e]">
          <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
            RSA-4096 E2EE
          </span>
          <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
            DPAPI Protected
          </span>
        </div>
      </div>

      {/* Interactive Circuit Conduit Track with Traveling Particles (Requirement 8) */}
      <div className="relative my-4">
        {/* Animated Connecting Vector Track (visible on md screens and up) */}
        <div className="hidden md:block absolute top-1/2 left-0 w-full -translate-y-1/2 pointer-events-none z-0 px-8">
          <svg className="w-full h-8 overflow-visible" preserveAspectRatio="none" viewBox="0 0 800 24">
            <defs>
              <linearGradient id="conduitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0066ff" stopOpacity="0.4" />
                <stop offset="35%" stopColor="#8b5cf6" stopOpacity="0.6" />
                <stop offset="70%" stopColor="#00e5ff" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.5" />
              </linearGradient>
              <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Base Wire */}
            <path
              d="M 40 12 L 760 12"
              stroke="rgba(255, 255, 255, 0.07)"
              strokeWidth="2"
              strokeDasharray="4 6"
            />

            {/* Active Cryptographic Conduit Flow */}
            {deviceOnline && (
              <path
                d="M 40 12 L 760 12"
                stroke="url(#conduitGrad)"
                strokeWidth="2"
                strokeDasharray="16 28"
                className="animate-conduit-flow"
                style={{ filter: isTransacting ? 'drop-shadow(0 0 8px rgba(0, 229, 255, 0.8))' : 'none' }}
              />
            )}
          </svg>
        </div>

        {/* Network Nodes Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
          {/* Node 1: Mobile Phone */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3 relative group hover:border-[#00e5ff]/40 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,102,255,0.18)] transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-[#0066ff]/15 border border-[#0066ff]/30 flex items-center justify-center text-[#00e5ff] shrink-0 shadow-[0_0_15px_rgba(0,102,255,0.25)] group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all">
              <Smartphone className="w-5 h-5 text-[#00e5ff]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#f0f3f6] truncate group-hover:text-white transition-colors">
                Owner Device
              </p>
              <p className="text-[10px] text-[#8b949e] font-mono truncate">Mobile Biometrics</p>
            </div>
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981]" />
          </div>

          {/* Node 2: iLock Cloud */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3 relative group hover:border-[#8b5cf6]/40 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(139,92,246,0.18)] transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-[#8b5cf6]/15 border border-[#8b5cf6]/30 flex items-center justify-center text-[#a855f7] shrink-0 shadow-[0_0_15px_rgba(139,92,246,0.25)] group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all">
              <Cloud className="w-5 h-5 text-[#c084fc]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#f0f3f6] truncate group-hover:text-white transition-colors">
                iLock Cloud
              </p>
              <p className="text-[10px] text-[#8b949e] font-mono truncate">Auth & Command Relays</p>
            </div>
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981]" />
          </div>

          {/* Node 3: Windows Agent Service */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3 relative group hover:border-[#00e5ff]/40 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,229,255,0.18)] transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-[#00e5ff]/15 border border-[#00e5ff]/30 flex items-center justify-center text-[#00e5ff] shrink-0 shadow-[0_0_15px_rgba(0,229,255,0.25)] group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(0,229,255,0.45)] transition-all">
              <Cpu className="w-5 h-5 text-[#00e5ff]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#f0f3f6] truncate group-hover:text-white transition-colors">
                iLockAgent.exe
              </p>
              <p className="text-[10px] text-[#8b949e] font-mono truncate">LocalSystem Service</p>
            </div>
            <span
              className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${
                deviceOnline ? 'bg-[#10b981] shadow-[0_0_6px_#10b981]' : 'bg-[#f43f5e]'
              }`}
            />
          </div>

          {/* Node 4: Target PC */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3 relative group hover:border-[#10b981]/40 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(16,185,129,0.18)] transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.25)] group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.45)] transition-all">
              <Laptop className="w-5 h-5 text-[#34d399]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#f0f3f6] truncate group-hover:text-white transition-colors">
                {deviceName}
              </p>
              <p className="text-[10px] text-[#8b949e] font-mono truncate flex items-center gap-1">
                {isWorkstationLocked ? (
                  <>
                    <Lock className="w-2.5 h-2.5 text-[#f59e0b]" />
                    <span className="text-[#fbbf24]">Locked</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-2.5 h-2.5 text-[#10b981]" />
                    <span className="text-[#34d399]">Active</span>
                  </>
                )}
              </p>
            </div>
            <span
              className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full ${
                deviceOnline ? 'bg-[#10b981] shadow-[0_0_6px_#10b981] animate-pulse' : 'bg-[#6b7280]'
              }`}
            />
          </div>
        </div>
      </div>

      {/* SVG Circuit Connector Strip */}
      <div className="w-full flex items-center justify-between text-[10px] text-[#8b949e] font-mono pt-2 border-t border-white/[0.05]">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00e5ff]" />
          <span>Biometric Key Enrolled</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-[#f59e0b]" />
          <span>Polling Rate: 1000ms</span>
        </span>
        <span className="hidden sm:inline text-right text-[#00e5ff]">
          Status: {deviceOnline ? 'Real-time Synchronized' : 'Standby / Offline'}
        </span>
      </div>
    </div>
  );
}
