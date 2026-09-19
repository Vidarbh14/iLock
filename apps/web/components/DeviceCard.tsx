'use client';

import React from 'react';
import Link from 'next/link';
import { Laptop, Lock, Shield, Cpu, HardDrive, Battery, Clock, KeyRound, ChevronRight, Fingerprint, Wifi, Zap } from 'lucide-react';
import type { Device } from '@ilock/shared';
import { DeviceStatusBadge } from './DeviceStatusBadge';
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
  const parsedTel = parseDeviceTelemetry(telemetry, device);

  const formatLastSeen = (isoString: string) => {
    const diffSeconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return new Date(isoString).toLocaleDateString();
  };

  return (
    <div className="glass-card p-5 transition-all duration-300 flex flex-col justify-between group">
      {/* Top row */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black/[0.04] border border-black/[0.08] flex items-center justify-center text-[#1d1d1f] shadow-sm group-hover:border-black/[0.16] transition-colors">
              <Laptop className="w-5 h-5 text-[#1d1d1f]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-[#1d1d1f] flex items-center gap-2">
                {device.deviceName}
              </h3>
              <p className="text-xs text-[#6e6e73]">
                {device.hostname || 'Windows Workstation'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <DeviceStatusBadge status={device.status} />
            {isOnline && telemetry && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border ${
                  telemetry.workstation_locked
                    ? 'bg-[#ff9500]/10 border-[#ff9500]/25 text-[#b26a00]'
                    : 'bg-[#34c759]/10 border-[#34c759]/25 text-[#248a3d]'
                }`}
              >
                {telemetry.workstation_locked ? (
                  <>
                    <Lock className="w-2.5 h-2.5" />
                    Locked
                  </>
                ) : (
                  <>
                    <Shield className="w-2.5 h-2.5" />
                    Active
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Telemetry info */}
        <div className="grid grid-cols-3 gap-2 my-2.5 p-2 rounded-xl bg-black/[0.02] border border-black/[0.05] text-[11px] text-[#6e6e73] font-mono">
          <div className="flex items-center gap-1.5 truncate" title={`CPU: ${parsedTel.cpuUsagePct}%`}>
            <Cpu className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
            <span>{parsedTel.cpuUsagePct}%</span>
          </div>
          <div className="flex items-center gap-1.5 truncate" title={`RAM: ${parsedTel.ramUsagePct}% (${parsedTel.ramUsedGb}G)`}>
            <HardDrive className="w-3.5 h-3.5 text-[#6e6e73] shrink-0" />
            <span>{parsedTel.ramUsagePct}%</span>
          </div>
          <div className="flex items-center gap-1.5 truncate" title={`Battery: ${parsedTel.batteryPct}%`}>
            <Battery className="w-3.5 h-3.5 text-[#34c759] shrink-0" />
            <span>{parsedTel.batteryPct}%</span>
            {parsedTel.isCharging && <Zap className="w-2.5 h-2.5 text-[#ff9500] fill-[#ff9500] shrink-0" />}
          </div>
        </div>

        {/* Wi-Fi & IP banner */}
        <div className="flex items-center justify-between text-[11px] text-[#6e6e73] mb-3 px-1">
          <span className="flex items-center gap-1.5 text-[#1d1d1f] font-medium truncate max-w-[140px]" title={parsedTel.wifiSsid}>
            <Wifi className="w-3 h-3 text-[#0071e3] shrink-0" />
            {parsedTel.wifiSsid}
          </span>
          <span className="font-mono text-[10px] text-[#86868b]">{parsedTel.localIp}</span>
        </div>

        <div className="flex items-center justify-between text-xs text-[#6e6e73] mb-4 px-1">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {formatLastSeen(device.lastSeen)}
          </span>
          <span className="font-mono text-[11px] text-[#86868b]">v{device.agentVersion}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-black/[0.06]">
        <button
          onClick={() => onGrantAccess(device)}
          disabled={!isOnline}
          className={`flex-1 py-2 px-3 rounded-full text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
            isOnline
              ? 'apple-btn-secondary'
              : 'bg-black/[0.02] text-[#86868b]/50 cursor-not-allowed border border-black/[0.04]'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-[#0071e3]" />
          Grant
        </button>

        {onUnlock && (
          <button
            onClick={() => onUnlock(device)}
            disabled={!isOnline}
            title="Unlock PC via Mobile Biometrics"
            className={`py-2 px-3.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 border ${
              isOnline
                ? 'bg-[#34c759]/15 border-[#34c759]/30 text-[#248a3d] hover:bg-[#34c759]/25 shadow-sm'
                : 'bg-black/[0.02] text-[#86868b]/50 cursor-not-allowed border-black/[0.04]'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5" />
            <span>Unlock</span>
          </button>
        )}

        <button
          onClick={() => onLock(device.id)}
          disabled={isLocking || !isOnline}
          title="Instant Workstation Lock"
          className="p-2 rounded-full apple-btn-secondary text-[#6e6e73] hover:text-[#1d1d1f] disabled:opacity-40"
        >
          <Lock className={`w-3.5 h-3.5 ${isLocking ? 'animate-spin text-[#0071e3]' : ''}`} />
        </button>

        <Link
          href={`/devices/${device.id}`}
          className="p-2 rounded-full apple-btn-secondary text-[#6e6e73] hover:text-[#1d1d1f]"
          title="Device Details"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
