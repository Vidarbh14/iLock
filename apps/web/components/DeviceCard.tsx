'use client';

import React, { useState } from 'react';
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
    <div className="relative rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/80 p-5 shadow-lg hover:border-slate-700/80 transition-all flex flex-col justify-between">
      {/* Top row */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-cyan-400 shadow-inner">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {device.deviceName}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {device.hostname || 'Windows Workstation'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <DeviceStatusBadge status={device.status} />
            {isOnline && telemetry && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  telemetry.workstation_locked
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
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
                    Unlocked
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Telemetry info */}
        <div className="grid grid-cols-3 gap-2 my-2.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800/50 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5 truncate" title={`CPU: ${parsedTel.cpuUsagePct}%`}>
            <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{parsedTel.cpuUsagePct}%</span>
          </div>
          <div className="flex items-center gap-1.5 truncate" title={`RAM: ${parsedTel.ramUsagePct}% (${parsedTel.ramUsedGb}G)`}>
            <HardDrive className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>{parsedTel.ramUsagePct}%</span>
          </div>
          <div className="flex items-center gap-1.5 truncate" title={`Battery: ${parsedTel.batteryPct}%`}>
            <Battery className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{parsedTel.batteryPct}%</span>
            {parsedTel.isCharging && <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />}
          </div>
        </div>

        {/* Wi-Fi & IP banner */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3 px-1">
          <span className="flex items-center gap-1 text-cyan-300 font-mono truncate max-w-[140px]" title={parsedTel.wifiSsid}>
            <Wifi className="w-3 h-3 text-cyan-400 shrink-0" />
            {parsedTel.wifiSsid}
          </span>
          <span className="font-mono text-[10px] text-slate-500">{parsedTel.localIp}</span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 mb-4 px-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Seen: {formatLastSeen(device.lastSeen)}
          </span>
          <span className="font-mono text-[11px] text-slate-500">v{device.agentVersion}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
        <button
          onClick={() => onGrantAccess(device)}
          disabled={!isOnline}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            isOnline
              ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
              : 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-800'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          Grant
        </button>

        {onUnlock && (
          <button
            onClick={() => onUnlock(device)}
            disabled={!isOnline}
            title="Unlock PC via Mobile Face ID / Fingerprint"
            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
              isOnline
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-slate-800/50 text-slate-500 cursor-not-allowed border-slate-800'
            }`}
          >
            <Fingerprint className="w-4 h-4 text-emerald-400" />
            <span>Unlock</span>
          </button>
        )}

        <button
          onClick={() => onLock(device.id)}
          disabled={isLocking || !isOnline}
          title="Instant Workstation Lock"
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors disabled:opacity-50"
        >
          <Lock className={`w-4 h-4 ${isLocking ? 'animate-spin text-cyan-400' : ''}`} />
        </button>

        <Link
          href={`/devices/${device.id}`}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          title="Device Details"
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
