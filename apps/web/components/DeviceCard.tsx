'use client';

import React from 'react';
import Link from 'next/link';
import {
  Laptop,
  Lock,
  Unlock,
  Shield,
  Cpu,
  HardDrive,
  Battery,
  Clock,
  KeyRound,
  ChevronRight,
  Fingerprint,
  Wifi,
  Zap,
  Activity,
  Loader2,
} from 'lucide-react';
import type { Device } from '@ilock/shared';
import { DeviceStatusBadge } from './DeviceStatusBadge';
import { CornerOrb } from './CornerOrb';
import { TelemetryGauge } from './TelemetryGauge';
import { parseDeviceTelemetry } from '@/lib/telemetry-helper';

interface Props {
  device: Device & { device_status?: any[] };
  onGrantAccess: (device: Device) => void;
  onLock: (deviceId: string) => void;
  onUnlock?: (device: Device) => void;
  isLocking?: boolean;
}

export function DeviceCard({ device, onGrantAccess, onLock, onUnlock, isLocking = false }: Props) {
  const telemetry = device.device_status?.[0];
  const isOnline = device.status === 'online';
  const isLocked = telemetry?.workstation_locked ?? false;
  const parsedTel = parseDeviceTelemetry(telemetry, device);

  const formatLastSeen = (isoString: string) => {
    const diffSeconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return new Date(isoString).toLocaleDateString();
  };

  return (
    <div className="glass-card p-5 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
      {/* Signature iLock Bubble Corner Elements */}
      <CornerOrb
        position="top-right"
        variant={isLocking ? 'rose' : isLocked ? 'amber' : isOnline ? 'cyan' : 'blue'}
        size="md"
        active={isOnline}
      />
      <CornerOrb
        position="bottom-left"
        variant={isOnline ? 'purple' : 'blue'}
        size="sm"
        active={isOnline}
      />

      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-4 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Centerpiece Device Avatar with Orbital Ring */}
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-center text-[#00e5ff] shadow-inner group-hover:border-[#00e5ff]/40 transition-all">
                <Laptop className="w-6 h-6 text-[#00e5ff]" />
              </div>
              {/* Status Indicator Pip */}
              <div
                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#0d111a] flex items-center justify-center ${
                  isOnline ? 'bg-[#10b981]' : 'bg-[#6b7280]'
                }`}
              >
                {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              </div>
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-semibold tracking-tight text-[#f0f3f6] flex items-center gap-2 truncate">
                {device.deviceName || (device as any).device_name || 'Windows Workstation'}
              </h3>
              <p className="text-xs text-[#8b949e] font-mono truncate">
                {device.hostname || 'Windows Workstation'}
              </p>
            </div>
          </div>

          {/* Badges: Online & Lock State */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <DeviceStatusBadge status={device.status} />
            {isOnline && telemetry && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider border ${
                  isLocked
                    ? 'bg-[#f59e0b]/15 border-[#f59e0b]/35 text-[#fbbf24]'
                    : 'bg-[#10b981]/15 border-[#10b981]/35 text-[#34d399]'
                }`}
              >
                {isLocked ? (
                  <>
                    <Lock className="w-2.5 h-2.5" />
                    LOCKED
                  </>
                ) : (
                  <>
                    <Activity className="w-2.5 h-2.5" />
                    IN USE
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Telemetry Visualizers Grid */}
        <div className="grid grid-cols-3 gap-2 my-3 relative z-10">
          {/* CPU Gauge */}
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] text-[#8b949e]">
              <span className="flex items-center gap-1 font-mono">
                <Cpu className="w-3 h-3 text-[#00e5ff]" /> CPU
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-bold font-mono text-[#f0f3f6]">
                {parsedTel.cpuUsagePct}%
              </span>
              <span className="text-[9px] text-[#8b949e] font-mono">Load</span>
            </div>
            {/* Visual mini bar */}
            <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-gradient-to-r from-[#0066ff] to-[#00e5ff] rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, parsedTel.cpuUsagePct)}%` }}
              />
            </div>
          </div>

          {/* RAM Gauge */}
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] text-[#8b949e]">
              <span className="flex items-center gap-1 font-mono">
                <HardDrive className="w-3 h-3 text-[#a855f7]" /> RAM
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-bold font-mono text-[#f0f3f6]">
                {parsedTel.ramUsagePct}%
              </span>
              <span className="text-[9px] text-[#8b949e] font-mono">{parsedTel.ramUsedGb}G</span>
            </div>
            {/* Visual mini bar */}
            <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-gradient-to-r from-[#8b5cf6] to-[#c084fc] rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, parsedTel.ramUsagePct)}%` }}
              />
            </div>
          </div>

          {/* Battery Gauge */}
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] text-[#8b949e]">
              <span className="flex items-center gap-1 font-mono">
                <Battery className="w-3 h-3 text-[#10b981]" /> PWR
              </span>
              {parsedTel.isCharging && <Zap className="w-2.5 h-2.5 text-[#f59e0b] fill-[#f59e0b]" />}
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-bold font-mono text-[#f0f3f6]">
                {parsedTel.batteryPct}%
              </span>
              <span className="text-[9px] text-[#8b949e] font-mono">
                {parsedTel.isCharging ? 'Charge' : 'Batt'}
              </span>
            </div>
            {/* Visual mini bar */}
            <div className="w-full h-1 bg-white/[0.08] rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  parsedTel.batteryPct > 20
                    ? 'bg-gradient-to-r from-[#10b981] to-[#34d399]'
                    : 'bg-[#f43f5e]'
                }`}
                style={{ width: `${Math.min(100, parsedTel.batteryPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Network & Local Telemetry Strip */}
        <div className="flex items-center justify-between text-[11px] text-[#8b949e] mb-3 px-1 font-mono">
          <span className="flex items-center gap-1.5 text-[#f0f3f6] font-medium truncate max-w-[150px]" title={parsedTel.wifiSsid}>
            <Wifi className="w-3 h-3 text-[#00e5ff] shrink-0" />
            <span className="truncate">{parsedTel.wifiSsid}</span>
          </span>
          <span className="text-[10px] text-[#8b949e]">{parsedTel.localIp}</span>
        </div>

        <div className="flex items-center justify-between text-xs text-[#8b949e] mb-4 px-1 font-mono text-[10px]">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-[#8b949e]" />
            {formatLastSeen(device.lastSeen)}
          </span>
          <span>v{device.agentVersion}</span>
        </div>
      </div>

      {/* Cybersecurity Command Action Buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/[0.07] relative z-10">
        {/* Grant Access Button */}
        <button
          onClick={() => onGrantAccess(device)}
          disabled={!isOnline}
          className={`flex-1 py-2 px-3 rounded-full text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            isOnline
              ? 'apple-btn-secondary'
              : 'bg-white/[0.02] text-[#8b949e]/40 cursor-not-allowed border border-white/[0.04]'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-[#00e5ff]" />
          <span>Grant Access</span>
        </button>

        {/* Biometric Unlock Button */}
        {onUnlock && (
          <button
            onClick={() => onUnlock(device)}
            disabled={!isOnline}
            title="Unlock PC via Mobile Biometrics"
            className={`py-2 px-3.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 border ${
              isOnline
                ? 'bg-[#10b981]/15 border-[#10b981]/35 text-[#34d399] hover:bg-[#10b981]/25 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : 'bg-white/[0.02] text-[#8b949e]/40 cursor-not-allowed border-white/[0.04]'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5 text-[#34d399]" />
            <span>Unlock</span>
          </button>
        )}

        {/* Quick Lock Button */}
        <button
          onClick={() => onLock(device.id)}
          disabled={isLocking || !isOnline}
          title={isLocking ? 'Locking...' : 'Lock Workstation'}
          className="p-2 rounded-full apple-btn-secondary text-[#f0f3f6] hover:text-[#00e5ff] disabled:opacity-40"
        >
          {isLocking ? (
            <Loader2 className="w-3.5 h-3.5 text-[#00e5ff] animate-spin" />
          ) : (
            <Lock className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Details Link */}
        <Link
          href={`/devices/${device.id}`}
          className="p-2 rounded-full apple-btn-secondary text-[#8b949e] hover:text-[#f0f3f6]"
          title="Device Security Audit"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
