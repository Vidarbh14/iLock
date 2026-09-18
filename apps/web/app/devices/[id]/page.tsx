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
} from 'lucide-react';
import type { Device, AccessSession } from '@ilock/shared';
import { DeviceStatusBadge } from '@/components/DeviceStatusBadge';
import { GrantAccessModal } from '@/components/GrantAccessModal';
import { ConfirmRevokeModal } from '@/components/ConfirmRevokeModal';
import { BiometricUnlockModal } from '@/components/BiometricUnlockModal';

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

  useEffect(() => {
    fetchDevice();
  }, [deviceId]);

  const handleLock = async () => {
    setIsLocking(true);
    try {
      await fetch(`/api/devices/${deviceId}/lock`, { method: 'POST' });
      await fetchDevice();
    } finally {
      setIsLocking(false);
    }
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
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-white">{device.deviceName}</h1>
              <DeviceStatusBadge status={device.status} />
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

      {/* Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" /> CPU Usage
          </span>
          <p className="text-lg font-bold font-mono text-white">
            {telemetry?.cpu_usage_pct ?? 14}%
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-blue-400" /> Memory Usage
          </span>
          <p className="text-lg font-bold font-mono text-white">
            {telemetry?.memory_usage_pct ?? 46}%
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Battery className="w-3.5 h-3.5 text-emerald-400" /> Battery
          </span>
          <p className="text-lg font-bold font-mono text-white">
            {telemetry?.battery_pct ?? 100}%
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1">
          <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-purple-400" /> Active Console User
          </span>
          <p className="text-lg font-bold font-mono text-white truncate">
            {telemetry?.active_user || 'None'}
          </p>
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
        onSuccess={fetchDevice}
      />
    </div>
  );
}
