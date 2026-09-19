'use client';

import React, { useState } from 'react';
import { KeyRound, Clock, AlertTriangle, X, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import type { Device } from '@ilock/shared';
import { CornerOrb } from './CornerOrb';

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
      setError(err.message || 'Authorization dispatch failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-lg glass-modal p-6 shadow-2xl space-y-5 relative overflow-hidden border border-white/[0.1]">
        <CornerOrb position="top-right" variant="cyan" size="sm" active />
        <CornerOrb position="bottom-left" variant="purple" size="sm" active />

        {/* Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#0066ff]/15 border border-[#0066ff]/30 text-[#00e5ff] shadow-[0_0_15px_rgba(0,102,255,0.3)]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#f0f3f6]">Grant Temporary Access</h3>
              <p className="text-xs text-[#8b949e] font-mono">Target: {device.deviceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/[0.08] text-[#8b949e] hover:text-[#f0f3f6] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 text-xs bg-[#f43f5e]/15 border border-[#f43f5e]/30 text-[#fb7185] rounded-2xl animate-shake">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          {/* Duration Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-2">
              Access Duration
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_DURATIONS.map((preset) => {
                const isSelected = !isCustom && selectedDuration === preset.minutes;
                return (
                  <button
                    key={preset.minutes}
                    type="button"
                    onClick={() => {
                      setSelectedDuration(preset.minutes);
                      setIsCustom(false);
                    }}
                    className={`relative py-2.5 px-3 rounded-xl text-xs font-mono font-medium transition-all duration-200 active:scale-95 border ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#0066ff]/35 to-[#00e5ff]/25 text-[#00e5ff] border-[#00e5ff]/60 shadow-[0_0_15px_rgba(0,229,255,0.3)] scale-[1.02]'
                        : 'bg-white/[0.04] text-[#8b949e] border-white/[0.08] hover:border-white/[0.2] hover:text-[#f0f3f6]'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#00e5ff] shadow-[0_0_6px_#00e5ff] animate-pulse" />
                    )}
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Minutes Input */}
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => setIsCustom(!isCustom)}
                className="text-[11px] text-[#00e5ff] hover:underline font-mono"
              >
                {isCustom ? '← Use standard presets' : '+ Enter custom duration in minutes'}
              </button>
              {isCustom && (
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="Minutes (e.g. 45)"
                  className="w-full mt-1.5 px-3 py-2 apple-input text-xs font-mono text-[#f0f3f6]"
                  autoFocus
                />
              )}
            </div>
          </div>

          {/* Purpose / Note */}
          <div>
            <label className="block text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-1.5">
              Session Purpose / Note (Optional)
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., Guest presentation, Colleague code review"
              className="w-full px-3 py-2.5 apple-input text-xs text-[#f0f3f6]"
            />
          </div>

          {/* Session Summary Card */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-xs font-mono space-y-1.5">
            <div className="flex justify-between text-[#8b949e]">
              <span>Duration:</span>
              <span className="text-[#f0f3f6] font-semibold">{effectiveDuration} Minutes</span>
            </div>
            <div className="flex justify-between text-[#8b949e]">
              <span>Auto-Revoke At:</span>
              <span className="text-[#00e5ff] font-semibold">
                {expiryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex justify-between text-[#8b949e]">
              <span>Security Policy:</span>
              <span className="text-[#10b981]">Workstation Auto-Locks at Expiry</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-full text-xs font-medium apple-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-full text-xs font-semibold text-white apple-btn-primary disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Authorizing...' : 'Authorize Session'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
