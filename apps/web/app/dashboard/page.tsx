'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import type { Device, AccessSession, AuditLog } from '@ilock/shared';
import { DeviceCard } from '@/components/DeviceCard';
import { GrantAccessModal } from '@/components/GrantAccessModal';
import { PairDeviceModal } from '@/components/PairDeviceModal';
import { ConfirmRevokeModal } from '@/components/ConfirmRevokeModal';
import { SessionCountdown } from '@/components/SessionCountdown';
import { BiometricUnlockModal } from '@/components/BiometricUnlockModal';

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
      if (auditData.logs) setRecentLogs(auditData.logs.slice(0, 5));
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

  return (
    <div className="space-y-6">
      {/* Top Banner: Greeting & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Command Center
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-[#2997ff]/10 text-[#2997ff] border border-[#2997ff]/25 backdrop-blur-md">
              Active
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-normal">
            Monitor and control temporary Windows access authorizations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            className="p-2 rounded-full apple-btn-secondary"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleLockAll}
            className="px-4 py-2 rounded-full text-xs font-medium apple-btn-danger flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-[#ff6961]" />
            Lock All PCs
          </button>

          <button
            onClick={() => setIsPairModalOpen(true)}
            className="px-4 py-2 rounded-full text-xs font-medium apple-btn-primary flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add PC
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff6961] rounded-2xl backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ACTIVE AUTHORIZATIONS ALERT CARD */}
      {activeSessions.length > 0 && (
        <div className="p-5 glass-panel rounded-3xl border border-[#2997ff]/30 space-y-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)] relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-[#2997ff]/10 blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2997ff] shadow-[0_0_10px_rgba(41,151,255,0.8)] animate-ping" />
              <h2 className="text-xs font-semibold text-white uppercase tracking-wider">
                Live Active Temporary Access ({activeSessions.length})
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#2997ff] px-2.5 py-0.5 rounded-full bg-[#2997ff]/10 border border-[#2997ff]/20">
              Time-Bound Session
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeSessions.map((session) => {
              const matchedDevice = devices.find((d) => d.id === session.deviceId);
              return (
                <div
                  key={session.id}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white">
                        {matchedDevice?.deviceName || 'Windows PC'}
                      </span>
                      <p className="text-[11px] text-slate-400">
                        {String(session.metadata?.purpose || 'Temporary user authorization')}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/30">
                      {session.status}
                    </span>
                  </div>

                  <SessionCountdown
                    expiresAt={session.expiresAt}
                    totalDurationMinutes={session.durationMinutes}
                    onExpire={loadData}
                  />

                  <div className="pt-2 flex items-center justify-end">
                    <button
                      onClick={() => setSelectedSessionForRevoke(session)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium apple-btn-danger flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5 text-[#ff6961]" />
                      Revoke Immediately
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MY DEVICES SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Laptop className="w-4 h-4 text-[#2997ff]" />
            My Registered Computers
            <span className="text-xs text-slate-400 font-mono">({devices.length})</span>
          </h2>
          <button
            onClick={() => setIsPairModalOpen(true)}
            className="text-xs text-[#2997ff] hover:underline flex items-center gap-1 font-medium"
          >
            Pair New Machine &rarr;
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-44 rounded-2xl glass-card animate-pulse"
              />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-12 rounded-3xl glass-card space-y-3">
            <Laptop className="w-10 h-10 text-slate-500 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-200">No computers enrolled yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Install the iLock Windows Agent on your laptop or PC and pair it in under 60 seconds.
            </p>
            <button
              onClick={() => setIsPairModalOpen(true)}
              className="px-5 py-2 text-xs font-medium text-white apple-btn-primary rounded-full transition-all"
            >
              Pair First Computer
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

      {/* RECENT SECURITY LOGS */}
      <div className="p-5 glass-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#30d158]" />
            <h3 className="text-sm font-semibold text-white">Recent Security Audit Trail</h3>
          </div>
          <a href="/security" className="text-xs text-[#2997ff] hover:underline font-medium">
            View All Logs &rarr;
          </a>
        </div>

        {recentLogs.length === 0 ? (
          <p className="text-xs text-slate-500">No security events recorded yet.</p>
        ) : (
          <div className="divide-y divide-white/[0.06] text-xs">
            {recentLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      log.success ? 'bg-[#30d158]' : 'bg-[#ff453a]'
                    }`}
                  />
                  <div className="truncate">
                    <span className="font-mono font-semibold text-slate-200">
                      {log.eventType}
                    </span>
                    <p className="text-slate-400 text-[11px] truncate">{log.reason}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 font-mono text-[11px] text-slate-500">
                  {new Date(log.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
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
