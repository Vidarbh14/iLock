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
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-[#2997ff]" />
          Grant Temporary Authorization
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Generate an encrypted, short-lived session token for someone at your Windows PC
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3.5 text-xs bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff6961] rounded-2xl backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="h-72 rounded-3xl glass-card animate-pulse" />
      ) : devices.length === 0 ? (
        <div className="p-8 text-center rounded-3xl glass-card space-y-3">
          <Laptop className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No paired computers found</h3>
          <p className="text-xs text-slate-400">
            You must pair at least one Windows PC before creating access authorizations.
          </p>
          <a
            href="/devices"
            className="inline-block px-5 py-2 text-xs font-medium text-white apple-btn-primary rounded-full"
          >
            Pair a PC Now
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* STEP 1: SELECT PC */}
          <div className="p-5 glass-card space-y-3">
            <span className="text-xs uppercase font-mono tracking-wider text-[#2997ff] font-semibold">
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
                    className={`p-4 rounded-2xl border text-left transition-all flex items-start justify-between ${
                      isSelected
                        ? 'bg-[#2997ff]/15 border-[#2997ff] text-white shadow-[0_0_16px_rgba(41,151,255,0.25)]'
                        : 'bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-semibold text-white">{device.deviceName}</h4>
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
          <div className="p-5 glass-card space-y-3">
            <span className="text-xs uppercase font-mono tracking-wider text-[#2997ff] font-semibold">
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
                    className={`py-2.5 px-3 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-[#2997ff] text-white shadow-[0_0_12px_rgba(41,151,255,0.4)] border border-[#2997ff]'
                        : 'bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
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
                className="text-xs text-[#2997ff] hover:underline flex items-center gap-1 font-medium"
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
                    className="apple-input px-3.5 py-2 text-sm font-mono w-32"
                  />
                  <span className="text-xs text-slate-400">minutes (max 1440 / 24 hours)</span>
                </div>
              )}
            </div>
          </div>

          {/* STEP 3: NOTE / PURPOSE */}
          <div className="p-5 glass-card space-y-2">
            <span className="text-xs uppercase font-mono tracking-wider text-[#2997ff] font-semibold">
              Step 3 • Authorization Purpose
            </span>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Brother printing college documents or playing a game"
              className="w-full apple-input px-3.5 py-2.5 text-sm"
            />
          </div>

          {/* REVIEW & CONFIRM */}
          <div className="p-6 glass-panel rounded-3xl space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#30d158]" />
              Review Authorization Details
            </h3>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-1.5 text-xs">
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
                <span className="font-mono font-semibold text-[#2997ff]">
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
                className="mt-0.5 rounded border-white/20 bg-black/40 text-[#2997ff] focus:ring-0"
              />
              <span className="text-xs text-slate-300 leading-relaxed">
                I authorize this temporary access session. The Windows PC will automatically lock
                upon expiration, or immediately if I hit Revoke.
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting || !selectedDevice}
              className="w-full py-3 px-4 rounded-full text-xs font-semibold apple-btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
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
