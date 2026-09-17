'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Laptop, Clock, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Device } from '@ilock/shared';
import { DeviceStatusBadge } from '@/components/DeviceStatusBadge';

const PRESET_DURATIONS = [
  { label: '15 Minutes', minutes: 15 },
  { label: '30 Minutes', minutes: 30 },
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
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-cyan-400" />
          Grant Temporary Authorization
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Generate an encrypted, short-lived session token for someone at your Windows PC
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3.5 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="h-72 rounded-2xl bg-slate-900/50 animate-pulse" />
      ) : devices.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <Laptop className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No paired computers found</h3>
          <p className="text-xs text-slate-400">
            You must pair at least one Windows PC before creating access authorizations.
          </p>
          <a
            href="/devices"
            className="inline-block px-4 py-2 text-xs font-bold text-white bg-cyan-600 rounded-xl"
          >
            Pair a PC Now
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* STEP 1: SELECT PC */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <span className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-bold">
              Step 1 • Target Computer
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {devices.map((device) => {
                const isSelected = selectedDeviceId === device.id;
                return (
                  <button
                    type="button"
                    key={device.id}
                    onClick={() => setSelectedDeviceId(device.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start justify-between ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white">{device.deviceName}</h4>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
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
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <span className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-bold">
              Step 2 • Access Duration
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-2">
              <button
                type="button"
                onClick={() => setIsCustom(!isCustom)}
                className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
              >
                <Clock className="w-3.5 h-3.5" />
                {isCustom ? 'Use standard duration' : 'Enter custom minutes'}
              </button>
              {isCustom && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="Minutes"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono w-32"
                  />
                  <span className="text-xs text-slate-400">minutes (max 1440 / 24 hours)</span>
                </div>
              )}
            </div>
          </div>

          {/* STEP 3: NOTE / PURPOSE */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
            <span className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-bold">
              Step 3 • Authorization Purpose
            </span>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Brother printing college documents or playing a game"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* REVIEW & CONFIRM */}
          <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Review Authorization Details
            </h3>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Computer:</span>
                <span className="font-semibold text-white">
                  {selectedDevice?.deviceName || 'None selected'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Duration:</span>
                <span className="font-mono text-slate-200">{effectiveDuration} Minutes</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Expires Authoritatively At:</span>
                <span className="font-mono font-bold text-cyan-400">
                  {expiryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (
                  {expiryTime.toLocaleDateString()})
                </span>
              </div>
            </div>

            <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0"
              />
              <span className="text-xs text-slate-300 leading-relaxed">
                I authorize this temporary access session. The Windows PC will automatically lock
                upon expiration, or immediately if I hit Revoke.
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting || !selectedDevice}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:opacity-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Dispatching Authorization...' : 'Confirm & Grant Access'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
