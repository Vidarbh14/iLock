'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  KeyRound,
  Laptop,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Zap,
  ArrowRight,
  Shield,
  Radio,
} from 'lucide-react';
import type { Device } from '@ilock/shared';
import { DeviceStatusBadge } from '@/components/DeviceStatusBadge';
import { CornerOrb } from '@/components/CornerOrb';

const PRESET_DURATIONS = [
  { label: '15 Min', minutes: 15 },
  { label: '30 Min', minutes: 30 },
  { label: '1 Hour', minutes: 60 },
  { label: '2 Hours', minutes: 120 },
];

export default function GrantAccessPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [purpose, setPurpose] = useState<string>('');
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/devices')
      .then((res) => res.json())
      .then((data) => {
        if (data.devices && data.devices.length > 0) {
          setDevices(data.devices);
          const online = data.devices.find((d: Device) => d.status === 'online');
          setSelectedDeviceId(online?.id || data.devices[0].id);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const effectiveDuration = isCustom ? parseInt(customMinutes, 10) || 30 : selectedDuration;
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);
  const expiryTime = new Date(Date.now() + effectiveDuration * 60 * 1000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) {
      setError('Please select a target computer.');
      return;
    }
    if (!isConfirmed) {
      setError('Please check the confirmation box to authorize access.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/access/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          durationMinutes: effectiveDuration,
          metadata: {
            purpose: purpose.trim() || 'Temporary remote authorization',
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to grant access');
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authorization creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="relative glass-card p-6 rounded-3xl border border-cyber-border overflow-hidden">
        <CornerOrb variant="cyan" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,229,255,0.15)]">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              Dispatch Access Authorization
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Issue a cryptographically signed, short-lived session token to unlock your Windows machine
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-4 text-xs bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-2xl">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="h-72 rounded-3xl glass-card animate-pulse border border-cyber-border" />
      ) : devices.length === 0 ? (
        <div className="p-8 text-center rounded-3xl glass-card border border-cyber-border space-y-3">
          <Laptop className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">No Paired Workstations Found</h3>
          <p className="text-xs text-slate-400">
            You must pair at least one Windows PC agent before creating access authorizations.
          </p>
          <Link
            href="/devices"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white cyber-btn-cyan rounded-xl mt-2"
          >
            Pair a Workstation Now
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* STEP 1: SELECT PC */}
          <div className="p-6 glass-card rounded-3xl space-y-3 border border-cyber-border">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Step 1 • Target Workstation
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {devices.length} Available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {devices.map((device) => {
                const isSelected = selectedDeviceId === device.id;
                return (
                  <button
                    type="button"
                    key={device.id}
                    onClick={() => setSelectedDeviceId(device.id)}
                    className={`p-4 rounded-2xl border text-left transition-all flex items-start justify-between ${
                      isSelected
                        ? 'bg-cyan-500/10 border-cyan-500 text-slate-100 shadow-[0_0_15px_rgba(0,229,255,0.15)] ring-1 ring-cyan-500/50'
                        : 'bg-slate-950/40 border-cyber-border/80 text-slate-300 hover:bg-slate-900/60 hover:border-cyber-border'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                        {device.deviceName}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono mt-1">
                        {device.hostname || 'Windows PC'}
                      </p>
                    </div>
                    <DeviceStatusBadge status={device.status} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: DURATION */}
          <div className="p-6 glass-card rounded-3xl space-y-4 border border-cyber-border">
            <span className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              Step 2 • Temporary Session Duration
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PRESET_DURATIONS.map((preset) => {
                const isSelected = !isCustom && selectedDuration === preset.minutes;
                return (
                  <button
                    type="button"
                    key={preset.minutes}
                    onClick={() => {
                      setIsCustom(false);
                      setSelectedDuration(preset.minutes);
                    }}
                    className={`py-3 px-4 rounded-xl text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold shadow-[0_0_15px_rgba(0,229,255,0.25)] border border-cyan-400'
                        : 'bg-slate-950/40 border border-cyber-border text-slate-300 hover:bg-slate-900 hover:text-slate-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div>
              <button
                type="button"
                onClick={() => setIsCustom(!isCustom)}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 font-medium transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                {isCustom ? '← Switch to preset durations' : 'Specify custom duration in minutes'}
              </button>
              {isCustom && (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="Minutes"
                    className="cyber-input px-3.5 py-2 text-sm font-mono w-32 bg-[#0b101b] text-[#00e5ff] rounded-xl focus:border-[#00e5ff] focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">minutes (maximum 1440 min / 24 hours)</span>
                </div>
              )}
            </div>
          </div>

          {/* STEP 3: NOTE / PURPOSE */}
          <div className="p-6 glass-card rounded-3xl space-y-2.5 border border-cyber-border">
            <span className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              Step 3 • Authorization Purpose & Context
            </span>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Colleague accessing Adobe Creative Cloud or brother running updates"
              className="w-full cyber-input px-4 py-3 text-sm text-[#00e5ff] bg-[#0b101b] placeholder-slate-500 rounded-xl focus:border-[#00e5ff] focus:outline-none"
            />
          </div>

          {/* REVIEW & CONFIRM */}
          <div className="p-6 glass-card rounded-3xl space-y-5 border border-cyan-500/30 shadow-[0_0_25px_rgba(0,229,255,0.05)]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Cryptographic Authorization Review
            </h3>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-cyber-border space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Target Workstation:</span>
                <span className="font-semibold text-slate-200">
                  {selectedDevice?.deviceName || 'None selected'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Allowed Timeframe:</span>
                <span className="text-cyan-400 font-bold">{effectiveDuration} Minutes</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Deterministic Expiry:</span>
                <span className="text-emerald-400 font-bold">
                  {expiryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (
                  {expiryTime.toLocaleDateString()})
                </span>
              </div>
            </div>

            <label className="flex items-start gap-3 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="mt-1 rounded bg-slate-900 border-cyber-border text-cyan-400 focus:ring-cyan-400/20"
              />
              <span className="text-xs text-slate-300 leading-relaxed">
                I authorize this temporary access session. The Windows agent will enforce the policy and lock
                the workstation strictly upon expiration or instant kill-switch revocation.
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting || !selectedDevice}
              className="w-full py-3.5 px-5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Dispatching Cryptographic Authorization...' : 'Dispatch Authorization'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
