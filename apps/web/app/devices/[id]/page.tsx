'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Laptop,
  Lock,
  KeyRound,
  Trash2,
  ArrowLeft,
  Shield,
  Clock,
  Cpu,
  HardDrive,
  Battery,
  User,
  AlertTriangle,
  Fingerprint,
  Wifi,
  Zap,
  Activity,
  Globe,
  Disc,
  Terminal,
} from 'lucide-react';
import type { Device, AccessSession } from '@ilock/shared';
import { DeviceStatusBadge } from '@/components/DeviceStatusBadge';
import { GrantAccessModal } from '@/components/GrantAccessModal';
import { ConfirmRevokeModal } from '@/components/ConfirmRevokeModal';
import { BiometricUnlockModal } from '@/components/BiometricUnlockModal';
import { parseDeviceTelemetry } from '@/lib/telemetry-helper';

export default function DeviceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id: deviceId } = params;

  const [device, setDevice] = useState<(Device & { device_status?: any[]; access_sessions?: AccessSession[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modals
  const [isGrantOpen, setIsGrantOpen] = useState(false);
  const [isUnlockOpen, setIsUnlockOpen] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<AccessSession | null>(null);

  const fetchDevice = async () => {
    try {
      const res = await fetch(`/api/devices/${deviceId}`);
      const data = await res.json();
      if (!res.ok || !data.device) {
        throw new Error(data.error?.message || 'Device not found');
      }
      setDevice(data.device);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerFastPolling = () => {
    const timers = [
      setTimeout(fetchDevice, 600),
      setTimeout(fetchDevice, 1500),
      setTimeout(fetchDevice, 3000),
    ];
    return () => timers.forEach(clearTimeout);
  };

  useEffect(() => {
    fetchDevice();
    // Auto-refresh device telemetry every 3 seconds
    const interval = setInterval(fetchDevice, 3000);
    return () => clearInterval(interval);
  }, [deviceId]);

  const handleLock = async () => {
    setIsLocking(true);

    // Optimistic UI update
    setDevice((prev) => {
      if (!prev) return prev;
      const statusList = prev.device_status && prev.device_status.length > 0
        ? [{ ...prev.device_status[0], workstation_locked: true }]
        : [{ workstation_locked: true }];
      return { ...prev, device_status: statusList };
    });

    try {
      await fetch(`/api/devices/${deviceId}/lock`, { method: 'POST' });
      triggerFastPolling();
    } finally {
      setIsLocking(false);
    }
  };

  const handleUnlockSuccess = () => {
    // Optimistic UI update
    setDevice((prev) => {
      if (!prev) return prev;
      const statusList = prev.device_status && prev.device_status.length > 0
        ? [{ ...prev.device_status[0], workstation_locked: false }]
        : [{ workstation_locked: false }];
      return { ...prev, device_status: statusList };
    });
    triggerFastPolling();
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove this computer? All active access sessions will be permanently revoked.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/devices');
      }
    } catch (err: any) {
      alert('Failed to remove device: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="h-64 rounded-2xl bg-slate-900/50 animate-pulse" />;
  }

  if (error || !device) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-white">Device Not Found</h2>
        <p className="text-xs text-slate-400">{error || 'Unable to load computer profile.'}</p>
        <Link href="/devices" className="text-xs text-cyan-400 hover:underline">
          &larr; Back to Devices
        </Link>
      </div>
    );
  }

  const telemetry = device.device_status?.[0];
  const sessions = device.access_sessions || [];
  const parsedTel = parseDeviceTelemetry(telemetry, device);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/devices"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-extrabold text-white">{device.deviceName}</h1>
              <DeviceStatusBadge status={device.status} />
              {device.status === 'online' && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    telemetry?.workstation_locked
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {telemetry?.workstation_locked ? (
                    <>
                      <Lock className="w-3 h-3" />
                      Locked
                    </>
                  ) : (
                    <>
                      <Shield className="w-3 h-3" />
                      Unlocked
                    </>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Hostname: {device.hostname || 'Unknown'} • UUID: {device.deviceUuid}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsUnlockOpen(true)}
            disabled={device.status !== 'online'}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.2)] disabled:opacity-50"
          >
            <Fingerprint className="w-4 h-4 text-emerald-400" />
            Unlock PC
          </button>
          <button
            onClick={handleLock}
            disabled={isLocking}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5"
          >
            <Lock className="w-4 h-4 text-cyan-400" />
            {isLocking ? 'Locking...' : 'Lock PC'}
          </button>
          <button
            onClick={() => setIsGrantOpen(true)}
            disabled={device.status !== 'online'}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.25)] disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4" />
            Grant Access
          </button>
        </div>
      </div>

      {/* Quick Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Wi-Fi Network */}
        <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" /> Wi-Fi Network
          </span>
          <p className="text-sm font-bold font-mono text-white truncate" title={parsedTel.wifiSsid}>
            {parsedTel.wifiSsid}
          </p>
          <div className="flex items-center gap-1 text-[10px] text-cyan-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {parsedTel.wifiSignal}% Signal
          </div>
        </div>

        {/* Battery & Power */}
        <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Battery className="w-3.5 h-3.5 text-emerald-400" /> Battery
          </span>
          <p className="text-lg font-bold font-mono text-white flex items-center gap-1">
            {parsedTel.batteryPct}%
            {parsedTel.isCharging && <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
          </p>
          <p className="text-[10px] text-slate-400">
            {parsedTel.isCharging ? 'AC Connected' : 'On Battery'}
          </p>
        </div>

        {/* CPU Usage */}
        <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" /> CPU Load
          </span>
          <p className="text-lg font-bold font-mono text-white">
            {parsedTel.cpuUsagePct}%
          </p>
          <p className="text-[10px] text-slate-400 font-mono truncate">
            {parsedTel.cpuCores} Threads
          </p>
        </div>

        {/* RAM Usage */}
        <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-400" /> RAM Memory
          </span>
          <p className="text-lg font-bold font-mono text-white">
            {parsedTel.ramUsagePct}%
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            {parsedTel.ramUsedGb} / {parsedTel.ramTotalGb} GB
          </p>
        </div>

        {/* Storage (C:) */}
        <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-purple-400" /> Storage (C:)
          </span>
          <p className="text-lg font-bold font-mono text-white">
            {parsedTel.diskFreeGb} GB
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            {parsedTel.diskUsagePct}% Used of {parsedTel.diskTotalGb}G
          </p>
        </div>

        {/* Security State */}
        <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" /> Security State
          </span>
          <p
            className={`text-lg font-bold font-mono ${
              telemetry?.workstation_locked ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {telemetry?.workstation_locked ? 'Locked' : 'Unlocked'}
          </p>
          <p className="text-[10px] text-slate-400 truncate">
            User: {parsedTel.user}
          </p>
        </div>
      </div>

      {/* High-Tech Real-Time Computer Hardware Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-slate-800 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">Live Hardware & System Telemetry</h3>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            Real-Time Sync Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          {/* Processor & OS */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800/60">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold">
              <Cpu className="w-4 h-4" />
              <span>Processor & Platform</span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div>
                <span className="text-slate-500">Model:</span>{' '}
                <span className="text-slate-200 font-bold">{parsedTel.cpuModel}</span>
              </div>
              <div>
                <span className="text-slate-500">Threads:</span>{' '}
                <span className="text-slate-300">{parsedTel.cpuCores} Logical Processors</span>
              </div>
              <div>
                <span className="text-slate-500">OS:</span>{' '}
                <span className="text-slate-300">{parsedTel.os}</span>
              </div>
              <div>
                <span className="text-slate-500">System Uptime:</span>{' '}
                <span className="text-emerald-400 font-bold">{parsedTel.uptime}</span>
              </div>
            </div>
            {/* CPU Meter */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>CPU Load</span>
                <span>{parsedTel.cpuUsagePct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, parsedTel.cpuUsagePct))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Memory & Storage */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800/60">
            <div className="flex items-center gap-2 text-blue-400 font-semibold">
              <HardDrive className="w-4 h-4" />
              <span>Memory & Drive Storage</span>
            </div>
            {/* RAM Progress */}
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">RAM: {parsedTel.ramUsedGb} GB / {parsedTel.ramTotalGb} GB</span>
                <span className="text-blue-300 font-bold">{parsedTel.ramUsagePct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                  style={{ width: `${parsedTel.ramUsagePct}%` }}
                />
              </div>
            </div>
            {/* Disk Progress */}
            <div className="space-y-1 font-mono text-[11px] pt-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Drive C: {parsedTel.diskFreeGb} GB Free</span>
                <span className="text-purple-300 font-bold">{parsedTel.diskUsagePct}% Used</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: `${parsedTel.diskUsagePct}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500">
                Total Capacity: {parsedTel.diskTotalGb} GB • Used: {parsedTel.diskUsedGb} GB
              </div>
            </div>
          </div>

          {/* Network & Console Session */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800/60">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <Wifi className="w-4 h-4" />
              <span>Network & Active Session</span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div>
                <span className="text-slate-500">Wi-Fi SSID:</span>{' '}
                <span className="text-cyan-300 font-bold">{parsedTel.wifiSsid}</span>
              </div>
              <div>
                <span className="text-slate-500">Signal Strength:</span>{' '}
                <span className="text-emerald-400 font-bold">{parsedTel.wifiSignal}%</span>
              </div>
              <div>
                <span className="text-slate-500">Local IP:</span>{' '}
                <span className="text-slate-200">{parsedTel.localIp}</span>
              </div>
              <div>
                <span className="text-slate-500">Console User:</span>{' '}
                <span className="text-purple-300 font-bold">{parsedTel.user}</span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Battery: {parsedTel.batteryPct}%</span>
              <span className="text-emerald-400 font-medium">
                {parsedTel.isCharging ? '⚡ Charging' : '🔋 Discharging'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cryptographic Identity Info Card */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Cryptographic Device Identity</h3>
        </div>
        <p className="text-xs text-slate-400">
          This workstation is bound to your account using asymmetric public-key cryptography (
          {device.publicKeyAlgorithm}). Private keys are securely protected by Windows DPAPI on the
          PC and never leave the device.
        </p>
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-400 overflow-x-auto">
          <code>{device.publicKey}</code>
        </div>
      </div>

      {/* Access Sessions on this PC */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          Temporary Access History
        </h3>

        {sessions.length === 0 ? (
          <p className="text-xs text-slate-500">No temporary access granted on this PC yet.</p>
        ) : (
          <div className="divide-y divide-slate-800/80 text-xs">
            {sessions.map((sess) => (
              <div key={sess.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">
                      {sess.durationMinutes} Minutes Access
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {sess.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(sess.createdAt).toLocaleString()} • Expires:{' '}
                    {new Date(sess.expiresAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {(sess.status === 'ACTIVE' || sess.status === 'EXPIRING' || sess.status === 'AUTHORIZED') && (
                  <button
                    onClick={() => setSessionToRevoke(sess)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone: Device Removal */}
      <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-900/40 space-y-3">
        <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          Danger Zone
        </h3>
        <p className="text-xs text-slate-400">
          Removing this machine disenrolls its public key, immediately invalidates all active
          sessions, and rejects further remote commands.
        </p>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg disabled:opacity-50"
        >
          {isDeleting ? 'Removing...' : 'Remove and Disenroll PC'}
        </button>
      </div>

      <GrantAccessModal
        device={device}
        isOpen={isGrantOpen}
        onClose={() => setIsGrantOpen(false)}
        onSuccess={fetchDevice}
      />

      <ConfirmRevokeModal
        session={sessionToRevoke}
        isOpen={!!sessionToRevoke}
        onClose={() => setSessionToRevoke(null)}
        onSuccess={fetchDevice}
      />

      <BiometricUnlockModal
        device={device}
        isOpen={isUnlockOpen}
        onClose={() => setIsUnlockOpen(false)}
        onSuccess={handleUnlockSuccess}
      />
    </div>
  );
}
