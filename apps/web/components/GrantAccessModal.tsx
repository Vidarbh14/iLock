'use client';

import React, { useState } from 'react';
import { KeyRound, Clock, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import type { Device } from '@ilock/shared';

interface Props {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESET_DURATIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

export function GrantAccessModal({ device, isOpen, onClose, onSuccess }: Props) {
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [purpose, setPurpose] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !device) return null;

  const effectiveDuration = isCustom ? parseInt(customMinutes, 10) || 30 : selectedDuration;
  const expiryTime = new Date(Date.now() + effectiveDuration * 60 * 1000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveDuration < 1 || effectiveDuration > 1440) {
      setError('Duration must be between 1 minute and 24 hours (1440 minutes).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/access/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          durationMinutes: effectiveDuration,
          metadata: {
            purpose: purpose.trim() || 'Temporary user authorization',
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to grant access');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Grant Temporary Access</h3>
              <p className="text-xs text-slate-400 font-mono">{device.deviceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Duration Presets */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Select Authorization Duration
            </label>
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
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Custom duration option */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setIsCustom(!isCustom)}
                className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
              >
                <Clock className="w-3.5 h-3.5" />
                {isCustom ? 'Use preset duration' : 'Enter custom duration'}
              </button>
              {isCustom && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="Minutes (e.g. 45)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <span className="text-xs text-slate-400">minutes</span>
                </div>
              )}
            </div>
          </div>

          {/* Reason / Purpose Note */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Purpose / Note (Optional)
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Brother printing documents"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Expiration Preview Card */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Automatic Expiration:</span>
              <span className="font-mono text-cyan-400 font-semibold">
                {expiryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Total Duration:</span>
              <span className="font-mono text-slate-200 font-medium">
                {effectiveDuration} minutes
              </span>
            </div>
          </div>

          {/* Security Notice */}
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Windows access will automatically lock when the session expires. You can revoke this
            access at any second from your phone.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                'Authorizing...'
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Grant Access
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
