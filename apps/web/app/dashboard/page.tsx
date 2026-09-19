'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Laptop,
  Plus,
  ShieldCheck,
  Lock,
  History,
  KeyRound,
  RefreshCw,
  AlertTriangle,
  Zap,
  Shield,
  Activity,
  Cpu,
  HardDrive,
  Battery,
  Wifi,
  Clock,
  Fingerprint,
  ChevronRight,
  Terminal,
  Radio,
  Server,
  Sparkles,
} from 'lucide-react';
import type { Device, AccessSession, AuditLog } from '@ilock/shared';
import { DeviceCard } from '@/components/DeviceCard';
import { DeviceStatusBadge } from '@/components/DeviceStatusBadge';
import { GrantAccessModal } from '@/components/GrantAccessModal';
import { PairDeviceModal } from '@/components/PairDeviceModal';
import { ConfirmRevokeModal } from '@/components/ConfirmRevokeModal';
import { SessionCountdown } from '@/components/SessionCountdown';
import { BiometricUnlockModal } from '@/components/BiometricUnlockModal';
import { ConnectionVisualizer } from '@/components/ConnectionVisualizer';
import { CornerOrb } from '@/components/CornerOrb';
import { TelemetryGauge } from '@/components/TelemetryGauge';
import { parseDeviceTelemetry } from '@/lib/telemetry-helper';

type DeviceWithStatus = Device & { device_status?: any[] };

export default function DashboardPage() {
  const [devices, setDevices] = useState<DeviceWithStatus[]>([]);
  const [activeSessions, setActiveSessions] = useState<AccessSession[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [selectedDeviceForGrant, setSelectedDeviceForGrant] = useState<Device | null>(null);
  const [selectedDeviceForUnlock, setSelectedDeviceForUnlock] = useState<DeviceWithStatus | null>(null);
  const [selectedSessionForRevoke, setSelectedSessionForRevoke] = useState<AccessSession | null>(null);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [lockingDeviceId, setLockingDeviceId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [devRes, sessRes, auditRes] = await Promise.all([
        fetch('/api/devices'),
        fetch('/api/access/active'),
        fetch('/api/audit'),
      ]);

      const [devData, sessData, auditData] = await Promise.all([
        devRes.json(),
        sessRes.json(),
        auditRes.json(),
      ]);

      if (devData.devices) setDevices(devData.devices);
      if (sessData.activeSessions) setActiveSessions(sessData.activeSessions);
      if (auditData.logs) setRecentLogs(auditData.logs.slice(0, 6));
    } catch (err: any) {
      setError('Could not connect to iLock Cloud. Check your network.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fast polling helper to capture instant agent responses
  const triggerFastPolling = useCallback(() => {
    const timers = [
      setTimeout(loadData, 600),
      setTimeout(loadData, 1500),
      setTimeout(loadData, 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [loadData]);

  useEffect(() => {
    loadData();
    // Auto-refresh telemetry every 3 seconds for near real-time status
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleLock = async (deviceId: string) => {
    setLockingDeviceId(deviceId);

    // Optimistic UI update: immediately mark as locked
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId
          ? {
              ...d,
              device_status:
                d.device_status && d.device_status.length > 0
                  ? [{ ...d.device_status[0], workstation_locked: true }]
                  : [{ workstation_locked: true }],
            }
          : d
      )
    );

    try {
      const res = await fetch(`/api/devices/${deviceId}/lock`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Lock failed');
      triggerFastPolling();
    } catch (err: any) {
      alert(`Lock command failed: ${err.message}`);
      loadData();
    } finally {
      setLockingDeviceId(null);
    }
  };

  const handleUnlockSuccess = (unlockedDevice: Device | null) => {
    if (unlockedDevice) {
      // Optimistic UI update: immediately mark as unlocked
      setDevices((prev) =>
        prev.map((d) =>
          d.id === unlockedDevice.id
            ? {
                ...d,
                device_status:
                  d.device_status && d.device_status.length > 0
                    ? [{ ...d.device_status[0], workstation_locked: false }]
                    : [{ workstation_locked: false }],
              }
            : d
        )
      );
    }
    triggerFastPolling();
  };

  const handleLockAll = async () => {
    const onlineDevices = devices.filter((d) => d.status === 'online');
    if (onlineDevices.length === 0) {
      alert('No online computers to lock.');
      return;
    }

    if (confirm(`Send lock command to ${onlineDevices.length} online computer(s)?`)) {
      await Promise.all(
        onlineDevices.map((d) => fetch(`/api/devices/${d.id}/lock`, { method: 'POST' }))
      );
      triggerFastPolling();
    }
  };

  const primaryDevice = devices[0] || null;
  const primaryTel = primaryDevice ? parseDeviceTelemetry(primaryDevice.device_status?.[0], primaryDevice) : null;
  const isPrimaryLocked = primaryDevice?.device_status?.[0]?.workstation_locked ?? false;
  const isPrimaryOnline = primaryDevice?.status === 'online';

  return (
    <div className="space-y-6">
      {/* Hero Header: Cybersecurity Command Center */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_10px_#00e5ff] animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#00e5ff] font-semibold">
              Live Console v2.0
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#f0f3f6]">
            Command Center
          </h1>
          <p className="text-xs sm:text-sm text-[#8b949e]">
            Your machines. Your access. Your zero-knowledge authorization conduit.
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleManualRefresh}
            className="p-2.5 rounded-2xl apple-btn-secondary"
            title="Force Synchronize State"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#00e5ff]' : 'text-[#8b949e]'}`} />
          </button>

          <button
            onClick={handleLockAll}
            disabled={devices.filter((d) => d.status === 'online').length === 0}
            className="px-4 py-2.5 rounded-2xl text-xs font-semibold apple-btn-danger flex items-center gap-2 disabled:opacity-40"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock All ({devices.filter((d) => d.status === 'online').length})</span>
          </button>

          <button
            onClick={() => setIsPairModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl text-xs font-semibold text-white apple-btn-primary flex items-center gap-2 shadow-[0_0_20px_rgba(0,102,255,0.4)]"
          >
            <Plus className="w-4 h-4" />
            <span>Enroll Computer</span>
          </button>
        </div>
      </div>

      {/* Network Cryptographic Pipeline Visualizer */}
      <ConnectionVisualizer
        deviceOnline={isPrimaryOnline}
        isWorkstationLocked={isPrimaryLocked}
        deviceName={primaryDevice?.deviceName || 'VIDHU Laptop'}
      />

      {/* Error notification */}
      {error && (
        <div className="flex items-center gap-2.5 p-3.5 text-xs bg-[#f43f5e]/15 border border-[#f43f5e]/30 text-[#fb7185] rounded-2xl animate-shake">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ACTIVE AUTHORIZATIONS ALERT CARD */}
      {activeSessions.length > 0 && (
        <div className="p-5 glass-card rounded-3xl border border-[#00e5ff]/30 space-y-4 shadow-[0_8px_32px_rgba(0,229,255,0.1)] relative overflow-hidden">
          <CornerOrb position="top-right" variant="cyan" size="md" active />
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00e5ff] shadow-[0_0_10px_#00e5ff] animate-ping" />
              <h2 className="text-xs font-semibold text-[#f0f3f6] uppercase tracking-wider font-mono">
                Active Temporary Authorizations ({activeSessions.length})
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#00e5ff] px-3 py-0.5 rounded-full bg-[#00e5ff]/10 border border-[#00e5ff]/25">
              Zero-Knowledge Session
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
            {activeSessions.map((session) => {
              const matchedDevice = devices.find((d) => d.id === session.deviceId);
              return (
                <div
                  key={session.id}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3 relative group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[#f0f3f6]">
                        {matchedDevice?.deviceName || (matchedDevice as any)?.device_name || 'Windows PC'}
                      </span>
                      <p className="text-[11px] text-[#8b949e]">
                        {String(session.metadata?.purpose || 'Temporary remote authorization')}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30">
                      {session.status}
                    </span>
                  </div>

                  <SessionCountdown
                    expiresAt={session.expiresAt || (session as any).expires_at}
                    totalDurationMinutes={session.durationMinutes || (session as any).duration_minutes || 15}
                    onExpire={loadData}
                  />

                  <div className="pt-2 flex items-center justify-end">
                    <button
                      onClick={() => setSelectedSessionForRevoke(session)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold apple-btn-danger flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5 text-[#fb7185]" />
                      <span>Kill Session</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SPOTLIGHT: PRIMARY COMPUTER CENTERPIECE & DETAILED RADAR (If computers exist) */}
      {primaryDevice && primaryTel && (
        <div className="glass-card p-6 rounded-3xl relative overflow-hidden border border-white/[0.09] shadow-2xl">
          <CornerOrb position="top-right" variant={isPrimaryLocked ? 'amber' : isPrimaryOnline ? 'cyan' : 'blue'} size="lg" active={isPrimaryOnline} />
          <CornerOrb position="bottom-left" variant="purple" size="sm" active />

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            {/* Left: Device Identity & State */}
            <div className="space-y-3 min-w-0 max-w-xl">
              <div className="flex items-center gap-2.5">
                <DeviceStatusBadge status={primaryDevice.status} />
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider border ${
                    isPrimaryLocked
                      ? 'bg-[#f59e0b]/15 border-[#f59e0b]/35 text-[#fbbf24]'
                      : 'bg-[#10b981]/15 border-[#10b981]/35 text-[#34d399]'
                  }`}
                >
                  {isPrimaryLocked ? (
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
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f0f3f6] flex items-center gap-3">
                  <Laptop className="w-7 h-7 text-[#00e5ff]" />
                  <span>{primaryDevice.deviceName}</span>
                </h2>
                <p className="text-xs text-[#8b949e] font-mono mt-1">
                  {primaryTel.os} • {primaryDevice.hostname} • Agent v{primaryDevice.agentVersion}
                </p>
              </div>

              {/* Quick Network & User Tag */}
              <div className="flex items-center gap-4 text-xs font-mono text-[#8b949e] pt-1">
                <span className="flex items-center gap-1 text-[#f0f3f6]">
                  <Wifi className="w-3.5 h-3.5 text-[#00e5ff]" />
                  <span>{primaryTel.wifiSsid}</span>
                </span>
                <span>IP: {primaryTel.localIp}</span>
                <span>User: {primaryTel.user}</span>
              </div>
            </div>

            {/* Right: Instant Command Execution Console */}
            <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap w-full lg:w-auto">
              <button
                onClick={() => setSelectedDeviceForGrant(primaryDevice)}
                disabled={!isPrimaryOnline}
                className="flex-1 lg:flex-none px-5 py-3 rounded-2xl text-xs font-semibold apple-btn-secondary flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <KeyRound className="w-4 h-4 text-[#00e5ff]" />
                <span>Grant Access</span>
              </button>

              <button
                onClick={() => setSelectedDeviceForUnlock(primaryDevice)}
                disabled={!isPrimaryOnline}
                className="flex-1 lg:flex-none px-5 py-3 rounded-2xl text-xs font-semibold bg-[#10b981]/15 hover:bg-[#10b981]/25 border border-[#10b981]/35 text-[#34d399] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all disabled:opacity-40"
              >
                <Fingerprint className="w-4 h-4" />
                <span>Biometric Unlock</span>
              </button>

              <button
                onClick={() => handleLock(primaryDevice.id)}
                disabled={lockingDeviceId === primaryDevice.id || !isPrimaryOnline}
                className="flex-1 lg:flex-none px-5 py-3 rounded-2xl text-xs font-semibold apple-btn-danger flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Lock className="w-4 h-4" />
                <span>{lockingDeviceId === primaryDevice.id ? 'Securing...' : 'Lock PC'}</span>
              </button>
            </div>
          </div>

          {/* Live Circular/Radial Telemetry Rings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6 pt-5 border-t border-white/[0.08] relative z-10">
            <TelemetryGauge
              label="CPU Performance"
              value={primaryTel.cpuUsagePct}
              subtitle={`${primaryTel.cpuCores} Cores`}
              icon={Cpu}
              variant="cyan"
            />
            <TelemetryGauge
              label="Memory Allocation"
              value={primaryTel.ramUsagePct}
              subtitle={`${primaryTel.ramUsedGb} GB / ${primaryTel.ramTotalGb} GB`}
              icon={HardDrive}
              variant="purple"
            />
            <TelemetryGauge
              label={primaryTel.isCharging ? 'AC Power Connected' : 'Battery Reserve'}
              value={primaryTel.batteryPct}
              subtitle={primaryTel.isCharging ? 'Charging' : 'Discharging'}
              icon={Battery}
              variant={primaryTel.batteryPct > 20 ? 'emerald' : 'amber'}
            />
          </div>
        </div>
      )}

      {/* ALL REGISTERED COMPUTERS GRID */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Laptop className="w-4 h-4 text-[#00e5ff]" />
            <h2 className="text-sm font-semibold text-[#f0f3f6] uppercase tracking-wider font-mono">
              Enrolled Workstations ({devices.length})
            </h2>
          </div>
          <button
            onClick={() => setIsPairModalOpen(true)}
            className="text-xs text-[#00e5ff] hover:underline flex items-center gap-1 font-mono"
          >
            + Enroll New PC
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 rounded-3xl glass-card animate-pulse" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          /* Empty State for New Users / Friends */
          <div className="text-center py-14 px-4 rounded-3xl glass-card space-y-4 border border-white/[0.08] relative overflow-hidden">
            <CornerOrb position="top-right" variant="cyan" size="sm" active />
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#00e5ff] mx-auto shadow-inner">
              <Laptop className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-[#f0f3f6]">No Windows computers enrolled yet</h3>
              <p className="text-xs text-[#8b949e] max-w-sm mx-auto">
                Pair your personal laptop or PC in 60 seconds with our zero-knowledge background service.
              </p>
            </div>
            <button
              onClick={() => setIsPairModalOpen(true)}
              className="px-6 py-2.5 text-xs font-semibold text-white apple-btn-primary rounded-full transition-all shadow-[0_0_20px_rgba(0,102,255,0.4)]"
            >
              + Pair Your First Computer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onGrantAccess={(dev) => setSelectedDeviceForGrant(dev)}
                onLock={handleLock}
                onUnlock={(dev) => setSelectedDeviceForUnlock(dev)}
                isLocking={lockingDeviceId === device.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* SECURITY STATUS CONSOLE & AUDIT TRAIL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Security Health Card */}
        <div className="p-5 glass-card rounded-3xl space-y-3 border border-white/[0.08] relative overflow-hidden">
          <CornerOrb position="top-right" variant="emerald" size="sm" active />
          
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold font-mono uppercase text-[#8b949e] tracking-wider">
              Security Posture
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-[#10b981] bg-[#10b981]/15 border border-[#10b981]/30">
              ACTIVE
            </span>
          </div>

          <div className="space-y-2 pt-1 font-mono text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <span className="text-[#8b949e]">Device Authority</span>
              <span className="text-[#f0f3f6]">Verified Owner</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <span className="text-[#8b949e]">Cryptography</span>
              <span className="text-[#00e5ff]">RSA-4096 / SHA-256</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <span className="text-[#8b949e]">Kernel Hook</span>
              <span className="text-[#34d399]">Win32 WorkStation</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              <span className="text-[#8b949e]">Vault Storage</span>
              <span className="text-[#a855f7]">DPAPI Protected</span>
            </div>
          </div>
        </div>

        {/* Audit Trail Timeline */}
        <div className="lg:col-span-2 p-5 glass-card rounded-3xl space-y-3.5 border border-white/[0.08]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00e5ff]" />
              <h3 className="text-sm font-semibold text-[#f0f3f6] uppercase tracking-wider font-mono">
                Recent Security Audit Events
              </h3>
            </div>
            <Link href="/security" className="text-xs text-[#00e5ff] hover:underline font-mono">
              View All Logs &rarr;
            </Link>
          </div>

          {recentLogs.length === 0 ? (
            <p className="text-xs text-[#8b949e] py-4">No security events recorded yet.</p>
          ) : (
            <div className="divide-y divide-white/[0.06] text-xs font-mono">
              {recentLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        log.success ? 'bg-[#10b981] shadow-[0_0_6px_#10b981]' : 'bg-[#f43f5e]'
                      }`}
                    />
                    <div className="truncate">
                      <span className="font-semibold text-[#f0f3f6]">
                        {log.eventType}
                      </span>
                      <p className="text-[#8b949e] text-[11px] truncate">{log.reason}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-[11px] text-[#8b949e]">
                    {new Date(log.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <GrantAccessModal
        device={selectedDeviceForGrant}
        isOpen={!!selectedDeviceForGrant}
        onClose={() => setSelectedDeviceForGrant(null)}
        onSuccess={loadData}
      />

      <ConfirmRevokeModal
        session={selectedSessionForRevoke}
        isOpen={!!selectedSessionForRevoke}
        onClose={() => setSelectedSessionForRevoke(null)}
        onSuccess={loadData}
      />

      <PairDeviceModal
        isOpen={isPairModalOpen}
        onClose={() => setIsPairModalOpen(false)}
        onDeviceRegistered={loadData}
      />

      <BiometricUnlockModal
        device={selectedDeviceForUnlock}
        isOpen={!!selectedDeviceForUnlock}
        onClose={() => setSelectedDeviceForUnlock(null)}
        onSuccess={() => handleUnlockSuccess(selectedDeviceForUnlock)}
      />
    </div>
  );
}
