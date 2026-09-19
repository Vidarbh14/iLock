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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md glass-modal p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#0071e3]/10 border border-[#0071e3]/20 text-[#0071e3] shadow-[0_0_12px_rgba(0,113,227,0.15)]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">Grant Temporary Access</h3>
              <p className="text-xs text-[#6e6e73] font-mono">{device.deviceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs bg-[#ff3b30]/10 border border-[#ff3b30]/25 text-[#ff3b30] rounded-2xl backdrop-blur-md">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Duration Presets */}
          <div>
            <label className="block text-xs font-medium text-[#1d1d1f] mb-2">
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
                    className={`py-2 px-3 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-[#0071e3] text-white shadow-[0_2px_8px_rgba(0,113,227,0.3)] border border-[#0071e3]'
                        : 'bg-black/[0.03] border border-black/[0.08] text-[#1d1d1f] hover:bg-black/[0.06]'
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
                className="text-xs text-[#0071e3] hover:underline flex items-center gap-1 font-medium"
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
                    className="flex-1 apple-input px-3 py-2 text-sm font-mono"
                  />
                  <span className="text-xs text-[#6e6e73]">minutes</span>
                </div>
              )}
            </div>
          </div>

          {/* Reason / Purpose Note */}
          <div>
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
              Purpose / Note (Optional)
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Brother printing documents"
              className="w-full apple-input px-3 py-2 text-sm"
            />
          </div>

          {/* Expiration Preview Card */}
          <div className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/[0.06] space-y-1.5 text-xs">
            <div className="flex justify-between text-[#6e6e73]">
              <span>Automatic Expiration:</span>
              <span className="font-mono text-[#0071e3] font-semibold">
                {expiryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex justify-between text-[#6e6e73]">
              <span>Total Duration:</span>
              <span className="font-mono text-[#1d1d1f] font-medium">
                {effectiveDuration} minutes
              </span>
            </div>
          </div>

          {/* Security Notice */}
          <p className="text-[11px] text-[#6e6e73] leading-relaxed">
            Windows access will automatically lock when the session expires. You can revoke this
            access at any second from your phone.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium apple-btn-secondary rounded-full"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-medium apple-btn-primary rounded-full disabled:opacity-50 flex items-center gap-1.5"
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
