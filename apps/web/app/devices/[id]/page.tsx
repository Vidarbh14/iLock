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
  Copy,
  Check,
  Radio,
  Server,
  Key,
} from 'lucide-react';
import type { Device, AccessSession } from '@ilock/shared';
import { DeviceStatusBadge } from '@/components/DeviceStatusBadge';
import { GrantAccessModal } from '@/components/GrantAccessModal';
import { ConfirmRevokeModal } from '@/components/ConfirmRevokeModal';
import { BiometricUnlockModal } from '@/components/BiometricUnlockModal';
import { CornerOrb } from '@/components/CornerOrb';
import { TelemetryGauge } from '@/components/TelemetryGauge';
import { parseDeviceTelemetry } from '@/lib/telemetry-helper';

export default function DeviceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id: deviceId } = params;

  const [device, setDevice] = useState<(Device & { device_status?: any[]; access_sessions?: AccessSession[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

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

  const handleCopyPublicKey = () => {
    if (device?.publicKey) {
      navigator.clipboard.writeText(device.publicKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-16 rounded-2xl bg-cyber-card/60 border border-cyber-border" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-cyber-card/40 border border-cyber-border/40" />
          ))}
        </div>
        <div className="h-72 rounded-3xl bg-cyber-card/30 border border-cyber-border/40" />
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="glass-card p-10 text-center space-y-4 max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-100">Workstation Not Found</h2>
        <p className="text-xs text-slate-400">{error || 'Unable to load computer profile.'}</p>
        <Link
          href="/devices"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Workstations
        </Link>
      </div>
    );
  }

  const telemetry = device.device_status?.[0];
  const sessions = device.access_sessions || [];
  const parsedTel = parseDeviceTelemetry(telemetry, device);
  const isOnline = device.status === 'online';
  const isLocked = Boolean(telemetry?.workstation_locked);

  const orbVariant = !isOnline ? 'rose' : isLocked ? 'amber' : 'cyan';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb / Nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/devices"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Workstations
        </Link>
        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          Node ID: <span className="text-slate-300">{device.id.slice(0, 8)}...</span>
        </span>
      </div>

      {/* Main Workstation Command Spotlight Header */}
      <div className="relative glass-card p-6 md:p-8 rounded-3xl border border-cyber-border overflow-hidden">
        <CornerOrb variant={orbVariant} pulse={isOnline} />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,229,255,0.15)]">
                <Laptop className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-100">{device.deviceName}</h1>
                  <DeviceStatusBadge status={device.status} />
                  {isOnline && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        isLocked
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      }`}
                    >
                      {isLocked ? (
                        <>
                          <Lock className="w-3 h-3 text-amber-400" />
                          Workstation Locked
                        </>
                      ) : (
                        <>
                          <Shield className="w-3 h-3 text-emerald-400" />
                          Workstation Unlocked
                        </>
                      )}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Hostname: <span className="text-slate-200">{device.hostname || 'Unknown'}</span> • Platform: <span className="text-slate-200">{parsedTel.os}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Action Triggers */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsUnlockOpen(true)}
              disabled={!isOnline}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-40 disabled:pointer-events-none"
            >
              <Fingerprint className="w-4 h-4" />
              Authorize & Unlock
            </button>
            <button
              onClick={handleLock}
              disabled={isLocking || !isOnline}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-cyber-card hover:bg-slate-800 border border-cyber-border hover:border-amber-500/40 transition-all flex items-center gap-2 disabled:opacity-40"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              {isLocking ? 'Sending Lock...' : 'Lock PC'}
            </button>
            <button
              onClick={() => setIsGrantOpen(true)}
              disabled={!isOnline}
              className="cyber-btn-cyan text-xs py-2.5 px-4 flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
            >
              <KeyRound className="w-4 h-4" />
              Grant Access
            </button>
          </div>
        </div>
      </div>

      {/* Radial Telemetry Overview Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <TelemetryGauge
          label="CPU Load"
          value={parsedTel.cpuUsagePct}
          subtitle={`${parsedTel.cpuCores} Cores`}
          icon={Cpu}
          variant="cyan"
        />

        <TelemetryGauge
          label="Memory Usage"
          value={parsedTel.ramUsagePct}
          subtitle={`${parsedTel.ramUsedGb} / ${parsedTel.ramTotalGb} GB`}
          icon={HardDrive}
          variant="purple"
        />

        <TelemetryGauge
          label="Drive C: Storage"
          value={parsedTel.diskUsagePct}
          subtitle={`${parsedTel.diskFreeGb} GB Free`}
          icon={Disc}
          variant="blue"
        />

        <TelemetryGauge
          label={parsedTel.isCharging ? 'AC Power' : 'Battery'}
          value={parsedTel.batteryPct}
          subtitle={parsedTel.isCharging ? '⚡ Connected' : '🔋 Discharging'}
          icon={Battery}
          variant={parsedTel.batteryPct > 20 ? 'emerald' : 'amber'}
        />
      </div>

      {/* Quick Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Wi-Fi Network */}
        <div className="p-4 rounded-2xl glass-card space-y-1.5 border border-cyber-border/70">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" /> Wi-Fi Network
          </span>
          <p className="text-sm font-semibold font-mono text-slate-100 truncate" title={parsedTel.wifiSsid}>
            {parsedTel.wifiSsid}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 font-mono">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {parsedTel.wifiSignal}% Signal
          </div>
        </div>

        {/* Battery & Power */}
        <div className="p-4 rounded-2xl glass-card space-y-1.5 border border-cyber-border/70">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Battery className="w-3.5 h-3.5 text-emerald-400" /> Battery State
          </span>
          <p className="text-sm font-bold font-mono text-slate-100 flex items-center gap-1">
            {parsedTel.batteryPct}%
            {parsedTel.isCharging && <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            {parsedTel.isCharging ? 'Charging' : 'Discharging'}
          </p>
        </div>

        {/* Console User */}
        <div className="p-4 rounded-2xl glass-card space-y-1.5 border border-cyber-border/70">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-purple-400" /> Console User
          </span>
          <p className="text-sm font-bold font-mono text-slate-100 truncate" title={parsedTel.user}>
            {parsedTel.user}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            Active Session
          </p>
        </div>

        {/* Local IP */}
        <div className="p-4 rounded-2xl glass-card space-y-1.5 border border-cyber-border/70">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-blue-400" /> Local IP
          </span>
          <p className="text-sm font-semibold font-mono text-slate-100 truncate" title={parsedTel.localIp}>
            {parsedTel.localIp}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            Subnet Bound
          </p>
        </div>

        {/* System Uptime */}
        <div className="p-4 rounded-2xl glass-card space-y-1.5 border border-cyber-border/70">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" /> System Uptime
          </span>
          <p className="text-sm font-bold font-mono text-slate-100 truncate" title={parsedTel.uptime}>
            {parsedTel.uptime}
          </p>
          <p className="text-[10px] text-emerald-400 font-mono">
            Healthy Daemon
          </p>
        </div>

        {/* Security State */}
        <div className="p-4 rounded-2xl glass-card space-y-1.5 border border-cyber-border/70">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" /> Lock State
          </span>
          <p
            className={`text-sm font-bold font-mono ${
              telemetry?.workstation_locked ? 'text-amber-300' : 'text-emerald-300'
            }`}
          >
            {telemetry?.workstation_locked ? 'Locked' : 'Unlocked'}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            DPAPI Protected
          </p>
        </div>
      </div>

      {/* Detailed Hardware & System Telemetry Console */}
      <div className="p-6 rounded-3xl glass-card space-y-5 border border-cyber-border">
        <div className="flex items-center justify-between pb-3 border-b border-cyber-border/60">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-100 tracking-wide">Live Hardware & Daemon Telemetry</h3>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            Continuous Sync (3s)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Processor & OS */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-950/40 border border-cyber-border/60">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold">
              <Cpu className="w-4 h-4" />
              <span>Processor & Platform</span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div>
                <span className="text-slate-400">Processor:</span>{' '}
                <span className="text-slate-200 font-medium">{parsedTel.cpuModel}</span>
              </div>
              <div>
                <span className="text-slate-400">Architecture:</span>{' '}
                <span className="text-slate-200">{parsedTel.cpuCores} Logical Processors</span>
              </div>
              <div>
                <span className="text-slate-400">Operating System:</span>{' '}
                <span className="text-slate-200">{parsedTel.os}</span>
              </div>
              <div>
                <span className="text-slate-400">Daemon Uptime:</span>{' '}
                <span className="text-emerald-400 font-medium">{parsedTel.uptime}</span>
              </div>
            </div>
            {/* CPU Bar */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>CPU Load</span>
                <span className="text-cyan-400 font-medium">{parsedTel.cpuUsagePct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, parsedTel.cpuUsagePct))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Memory & Storage */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-950/40 border border-cyber-border/60">
            <div className="flex items-center gap-2 text-purple-400 font-semibold">
              <HardDrive className="w-4 h-4" />
              <span>Memory & Drive Storage</span>
            </div>
            {/* RAM Progress */}
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">RAM: {parsedTel.ramUsedGb} / {parsedTel.ramTotalGb} GB</span>
                <span className="text-purple-400 font-medium">{parsedTel.ramUsagePct}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: `${parsedTel.ramUsagePct}%` }}
                />
              </div>
            </div>
            {/* Disk Progress */}
            <div className="space-y-1 font-mono text-[11px] pt-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Drive C: {parsedTel.diskFreeGb} GB Free</span>
                <span className="text-blue-400 font-medium">{parsedTel.diskUsagePct}% Used</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${parsedTel.diskUsagePct}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400">
                Total Capacity: {parsedTel.diskTotalGb} GB • Used: {parsedTel.diskUsedGb} GB
              </div>
            </div>
          </div>

          {/* Network & Security Enclave */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-950/40 border border-cyber-border/60">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <Wifi className="w-4 h-4" />
              <span>Network & Active Session</span>
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div>
                <span className="text-slate-400">Wi-Fi SSID:</span>{' '}
                <span className="text-cyan-400 font-medium">{parsedTel.wifiSsid}</span>
              </div>
              <div>
                <span className="text-slate-400">Signal Strength:</span>{' '}
                <span className="text-emerald-400 font-medium">{parsedTel.wifiSignal}%</span>
              </div>
              <div>
                <span className="text-slate-400">Local IP:</span>{' '}
                <span className="text-slate-200">{parsedTel.localIp}</span>
              </div>
              <div>
                <span className="text-slate-400">Console User:</span>{' '}
                <span className="text-purple-300 font-medium">{parsedTel.user}</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-cyber-border/60 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Battery: {parsedTel.batteryPct}%</span>
              <span className="text-emerald-400 font-medium">
                {parsedTel.isCharging ? '⚡ AC Connected' : '🔋 Battery Active'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cryptographic Device Identity Card */}
      <div className="p-6 glass-card rounded-3xl space-y-4 border border-cyber-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Cryptographic Workstation Identity</h3>
              <p className="text-xs text-slate-400">Asymmetric DPAPI Key Enclave ({device.publicKeyAlgorithm})</p>
            </div>
          </div>
          <button
            onClick={handleCopyPublicKey}
            className="px-3 py-1.5 rounded-xl text-xs font-mono text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all flex items-center gap-1.5"
          >
            {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedKey ? 'Copied' : 'Copy Key'}
          </button>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          This workstation is cryptographically bound to your account using asymmetric public-key cryptography.
          The private signing key is encrypted inside the Windows DPAPI master vault on this physical machine
          and never leaves the hardware.
        </p>
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-cyber-border/80 font-mono text-[10px] text-cyan-300 overflow-x-auto leading-relaxed">
          <code>{device.publicKey}</code>
        </div>
      </div>

      {/* Access Sessions on this PC */}
      <div className="p-6 glass-card rounded-3xl space-y-4 border border-cyber-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Access Authorization History
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            {sessions.length} recorded session{sessions.length === 1 ? '' : 's'}
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-slate-950/30 border border-cyber-border/40 text-xs text-slate-400">
            No access authorizations recorded on this workstation yet.
          </div>
        ) : (
          <div className="divide-y divide-cyber-border/60 text-xs">
            {sessions.map((sess) => (
              <div key={sess.id} className="py-3.5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">
                      {sess.durationMinutes} Minutes Session
                    </span>
                    <span
                      className={`text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full border ${
                        sess.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : sess.status === 'EXPIRING'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {sess.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">
                    Created {new Date(sess.createdAt).toLocaleTimeString()} • Expires:{' '}
                    <span className="text-slate-300">
                      {new Date(sess.expiresAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </p>
                </div>

                {(sess.status === 'ACTIVE' || sess.status === 'EXPIRING' || sess.status === 'AUTHORIZED') && (
                  <button
                    onClick={() => setSessionToRevoke(sess)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center gap-1.5"
                  >
                    <Lock className="w-3 h-3" />
                    Revoke Now
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone: Device Disenrollment */}
      <div className="p-6 rounded-3xl bg-rose-950/15 border border-rose-500/30 space-y-3">
        <h3 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          Workstation Disenrollment
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Removing this machine permanently revokes its cryptographic enrollment, immediately invalidates all active sessions,
          and rejects any future heartbeats from its Windows background agent.
        </p>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] disabled:opacity-50"
        >
          {isDeleting ? 'Disenrolling...' : 'Remove and Disenroll PC'}
        </button>
      </div>

      {/* Reusable Modals */}
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
