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
        <AlertTriangle className="w-10 h-10 text-[#ff3b30] mx-auto" />
        <h2 className="text-base font-bold text-[#1d1d1f]">Device Not Found</h2>
        <p className="text-xs text-[#6e6e73]">{error || 'Unable to load computer profile.'}</p>
        <Link href="/devices" className="text-xs text-[#0071e3] hover:underline">
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
            className="p-2 rounded-full apple-btn-secondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">{device.deviceName}</h1>
              <DeviceStatusBadge status={device.status} />
              {device.status === 'online' && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    telemetry?.workstation_locked
                      ? 'bg-[#ff9500]/10 border-[#ff9500]/25 text-[#c97500]'
                      : 'bg-[#34c759]/10 border-[#34c759]/25 text-[#248a3d]'
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
            <p className="text-xs text-[#6e6e73] font-mono mt-0.5">
              Hostname: {device.hostname || 'Unknown'} • UUID: {device.deviceUuid}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsUnlockOpen(true)}
            disabled={device.status !== 'online'}
            className="px-4 py-2 rounded-full text-xs font-semibold text-white bg-[#34c759] hover:bg-[#2db84d] transition-all flex items-center gap-1.5 shadow-[0_4px_14px_rgba(52,199,89,0.3)] disabled:opacity-50"
          >
            <Fingerprint className="w-4 h-4 text-white" />
            Unlock PC
          </button>
          <button
            onClick={handleLock}
            disabled={isLocking}
            className="px-4 py-2 rounded-full text-xs font-medium apple-btn-secondary flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-[#0071e3]" />
            {isLocking ? 'Locking...' : 'Lock PC'}
          </button>
          <button
            onClick={() => setIsGrantOpen(true)}
            disabled={device.status !== 'online'}
            className="px-4 py-2 rounded-full text-xs font-medium apple-btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4" />
            Grant Access
          </button>
        </div>
      </div>

      {/* Quick Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Wi-Fi Network */}
        <div className="p-4 rounded-2xl glass-card space-y-1">
          <span className="text-[11px] text-[#6e6e73] flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-[#0071e3]" /> Wi-Fi Network
          </span>
          <p className="text-sm font-semibold font-mono text-[#1d1d1f] truncate" title={parsedTel.wifiSsid}>
            {parsedTel.wifiSsid}
          </p>
          <div className="flex items-center gap-1 text-[10px] text-[#0071e3]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0071e3] animate-pulse" />
            {parsedTel.wifiSignal}% Signal
          </div>
        </div>

        {/* Battery & Power */}
        <div className="p-4 rounded-2xl glass-card space-y-1">
          <span className="text-[11px] text-[#6e6e73] flex items-center gap-1.5">
            <Battery className="w-3.5 h-3.5 text-[#34c759]" /> Battery
          </span>
          <p className="text-lg font-bold font-mono text-[#1d1d1f] flex items-center gap-1">
            {parsedTel.batteryPct}%
            {parsedTel.isCharging && <Zap className="w-3.5 h-3.5 text-[#ff9500] fill-[#ff9500]" />}
          </p>
          <p className="text-[10px] text-[#6e6e73]">
            {parsedTel.isCharging ? 'AC Connected' : 'On Battery'}
          </p>
        </div>

        {/* CPU Usage */}
        <div className="p-4 rounded-2xl glass-card space-y-1">
          <span className="text-[11px] text-[#6e6e73] flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#af52de]" /> CPU Load
          </span>
          <p className="text-lg font-bold font-mono text-[#1d1d1f]">
            {parsedTel.cpuUsagePct}%
          </p>
          <p className="text-[10px] text-[#6e6e73] font-mono truncate">
            {parsedTel.cpuCores} Threads
          </p>
        </div>

        {/* RAM Usage */}
        <div className="p-4 rounded-2xl glass-card space-y-1">
          <span className="text-[11px] text-[#6e6e73] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#0071e3]" /> RAM Memory
          </span>
          <p className="text-lg font-bold font-mono text-[#1d1d1f]">
            {parsedTel.ramUsagePct}%
          </p>
          <p className="text-[10px] text-[#6e6e73] font-mono">
            {parsedTel.ramUsedGb} / {parsedTel.ramTotalGb} GB
          </p>
        </div>

        {/* Storage (C:) */}
        <div className="p-4 rounded-2xl glass-card space-y-1">
          <span className="text-[11px] text-[#6e6e73] flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-[#5856d6]" /> Storage (C:)
          </span>
          <p className="text-lg font-bold font-mono text-[#1d1d1f]">
            {parsedTel.diskFreeGb} GB
          </p>
          <p className="text-[10px] text-[#6e6e73] font-mono">
            {parsedTel.diskUsagePct}% Used of {parsedTel.diskTotalGb}G
          </p>
        </div>

        {/* Security State */}
        <div className="p-4 rounded-2xl glass-card space-y-1">
          <span className="text-[11px] text-[#6e6e73] flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#ff9500]" /> Security State
          </span>
          <p
            className={`text-lg font-bold font-mono ${
              telemetry?.workstation_locked ? 'text-[#c97500]' : 'text-[#248a3d]'
            }`}
          >
            {telemetry?.workstation_locked ? 'Locked' : 'Unlocked'}
          </p>
          <p className="text-[10px] text-[#6e6e73] truncate">
            User: {parsedTel.user}
          </p>
        </div>
      </div>

      {/* High-Tech Real-Time Computer Hardware Card */}
      <div className="p-6 rounded-3xl glass-card space-y-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.06]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#0071e3]" />
            <h3 className="text-sm font-semibold text-[#1d1d1f] tracking-wide">Live Hardware & System Telemetry</h3>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 border border-[#0071e3]/20 text-[#0071e3] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3] animate-ping" />
            Real-Time Sync Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          {/* Processor & OS */}
          <div className="space-y-3 p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06]">
            <div className="flex items-center gap-2 text-[#0071e3] font-medium">
              <Cpu className="w-4 h-4" />
              <span>Processor & Platform</span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div>
                <span className="text-[#6e6e73]">Model:</span>{' '}
                <span className="text-[#1d1d1f] font-medium">{parsedTel.cpuModel}</span>
              </div>
              <div>
                <span className="text-[#6e6e73]">Threads:</span>{' '}
                <span className="text-[#1d1d1f]">{parsedTel.cpuCores} Logical Processors</span>
              </div>
              <div>
                <span className="text-[#6e6e73]">OS:</span>{' '}
                <span className="text-[#1d1d1f]">{parsedTel.os}</span>
              </div>
              <div>
                <span className="text-[#6e6e73]">System Uptime:</span>{' '}
                <span className="text-[#248a3d] font-medium">{parsedTel.uptime}</span>
              </div>
            </div>
            {/* CPU Meter */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] text-[#6e6e73]">
                <span>CPU Load</span>
                <span className="text-[#1d1d1f] font-medium">{parsedTel.cpuUsagePct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#0071e3] to-[#af52de] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, parsedTel.cpuUsagePct))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Memory & Storage */}
          <div className="space-y-3 p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06]">
            <div className="flex items-center gap-2 text-[#0071e3] font-medium">
              <HardDrive className="w-4 h-4" />
              <span>Memory & Drive Storage</span>
            </div>
            {/* RAM Progress */}
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#6e6e73]">RAM: {parsedTel.ramUsedGb} GB / {parsedTel.ramTotalGb} GB</span>
                <span className="text-[#0071e3] font-medium">{parsedTel.ramUsagePct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#0071e3] to-[#34c759] rounded-full transition-all duration-500"
                  style={{ width: `${parsedTel.ramUsagePct}%` }}
                />
              </div>
            </div>
            {/* Disk Progress */}
            <div className="space-y-1 font-mono text-[11px] pt-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#6e6e73]">Drive C: {parsedTel.diskFreeGb} GB Free</span>
                <span className="text-[#af52de] font-medium">{parsedTel.diskUsagePct}% Used</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#af52de] to-[#ff2d55] rounded-full transition-all duration-500"
                  style={{ width: `${parsedTel.diskUsagePct}%` }}
                />
              </div>
              <div className="text-[10px] text-[#6e6e73]">
                Total Capacity: {parsedTel.diskTotalGb} GB • Used: {parsedTel.diskUsedGb} GB
              </div>
            </div>
          </div>

          {/* Network & Console Session */}
          <div className="space-y-3 p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06]">
            <div className="flex items-center gap-2 text-[#248a3d] font-medium">
              <Wifi className="w-4 h-4" />
              <span>Network & Active Session</span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div>
                <span className="text-[#6e6e73]">Wi-Fi SSID:</span>{' '}
                <span className="text-[#0071e3] font-medium">{parsedTel.wifiSsid}</span>
              </div>
              <div>
                <span className="text-[#6e6e73]">Signal Strength:</span>{' '}
                <span className="text-[#248a3d] font-medium">{parsedTel.wifiSignal}%</span>
              </div>
              <div>
                <span className="text-[#6e6e73]">Local IP:</span>{' '}
                <span className="text-[#1d1d1f]">{parsedTel.localIp}</span>
              </div>
              <div>
                <span className="text-[#6e6e73]">Console User:</span>{' '}
                <span className="text-[#af52de] font-medium">{parsedTel.user}</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-black/[0.03] border border-black/[0.06] text-[10px] text-[#6e6e73] flex items-center justify-between">
              <span>Battery: {parsedTel.batteryPct}%</span>
              <span className="text-[#248a3d] font-medium">
                {parsedTel.isCharging ? '⚡ Charging' : '🔋 Discharging'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cryptographic Identity Info Card */}
      <div className="p-5 glass-card space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#0071e3]" />
          <h3 className="text-sm font-semibold text-[#1d1d1f]">Cryptographic Device Identity</h3>
        </div>
        <p className="text-xs text-[#6e6e73]">
          This workstation is bound to your account using asymmetric public-key cryptography (
          {device.publicKeyAlgorithm}). Private keys are securely protected by Windows DPAPI on the
          PC and never leave the device.
        </p>
        <div className="p-3.5 rounded-2xl bg-black/[0.03] border border-black/[0.06] font-mono text-[10px] text-[#1d1d1f] overflow-x-auto">
          <code>{device.publicKey}</code>
        </div>
      </div>

      {/* Access Sessions on this PC */}
      <div className="p-5 glass-card space-y-4">
        <h3 className="text-sm font-semibold text-[#1d1d1f] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#0071e3]" />
          Temporary Access History
        </h3>

        {sessions.length === 0 ? (
          <p className="text-xs text-[#6e6e73]">No temporary access granted on this PC yet.</p>
        ) : (
          <div className="divide-y divide-black/[0.06] text-xs">
            {sessions.map((sess) => (
              <div key={sess.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1d1d1f]">
                      {sess.durationMinutes} Minutes Access
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-black/[0.04] text-[#1d1d1f] border border-black/[0.08]">
                      {sess.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6e6e73] mt-0.5">
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
                    className="px-3 py-1.5 rounded-full text-xs font-medium apple-btn-danger"
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
      <div className="p-5 rounded-3xl bg-[#ff3b30]/5 border border-[#ff3b30]/20 space-y-3">
        <h3 className="text-sm font-semibold text-[#ff3b30] flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          Danger Zone
        </h3>
        <p className="text-xs text-[#6e6e73]">
          Removing this machine disenrolls its public key, immediately invalidates all active
          sessions, and rejects further remote commands.
        </p>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-5 py-2 rounded-full text-xs font-medium text-white apple-btn-danger transition-all disabled:opacity-50"
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
