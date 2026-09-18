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
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Command Center
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Active
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor and control temporary Windows access authorizations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleLockAll}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(244,63,94,0.15)]"
          >
            <Lock className="w-4 h-4 text-rose-400" />
            Lock All PCs
          </button>

          <button
            onClick={() => setIsPairModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)]"
          >
            <Plus className="w-4 h-4" />
            Add PC
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ACTIVE AUTHORIZATIONS ALERT CARD */}
      {activeSessions.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-blue-950/40 border border-cyan-500/40 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-ping" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Live Active Temporary Access ({activeSessions.length})
              </h2>
            </div>
            <span className="text-[11px] font-mono text-cyan-400">Time-Bound Session</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeSessions.map((session) => {
              const matchedDevice = devices.find((d) => d.id === session.deviceId);
              return (
                <div
                  key={session.id}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-white">
                        {matchedDevice?.deviceName || 'Windows PC'}
                      </span>
                      <p className="text-[11px] text-slate-400">
                        {String(session.metadata?.purpose || 'Temporary user authorization')}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
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
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 transition-colors flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5 text-rose-400" />
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
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Laptop className="w-4 h-4 text-cyan-400" />
            My Registered Computers
            <span className="text-xs text-slate-400 font-mono">({devices.length})</span>
          </h2>
          <button
            onClick={() => setIsPairModalOpen(true)}
            className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
          >
            Pair New Machine &rarr;
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-44 rounded-2xl bg-slate-900/50 border border-slate-800/60 animate-pulse"
              />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-slate-900/40 border border-slate-800/60 space-y-3">
            <Laptop className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No computers enrolled yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Install the iLock Windows Agent on your laptop or PC and pair it in under 60 seconds.
            </p>
            <button
              onClick={() => setIsPairModalOpen(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl transition-colors"
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
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Recent Security Audit Trail</h3>
          </div>
          <a href="/security" className="text-xs text-cyan-400 hover:underline font-medium">
            View All Logs &rarr;
          </a>
        </div>

        {recentLogs.length === 0 ? (
          <p className="text-xs text-slate-500">No security events recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-800/60 text-xs">
            {recentLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      log.success ? 'bg-emerald-400' : 'bg-rose-400'
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
