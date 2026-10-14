'use client';

import React, { useState } from 'react';
import {
  Moon,
  RotateCw,
  MonitorOff,
  Power,
  X,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';

interface PowerControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
  onSuccess?: (msg: string) => void;
}

export function PowerControlsModal({
  isOpen,
  onClose,
  deviceId,
  deviceName,
  onSuccess,
}: PowerControlsModalProps) {
  const [selectedAction, setSelectedAction] = useState<'sleep' | 'restart' | 'display_off' | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecute = async () => {
    if (!selectedAction) return;

    setIsExecuting(true);
    setError(null);

    try {
      const res = await fetch(`/api/devices/${deviceId}/power`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: selectedAction }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to dispatch power command');
      }

      onSuccess?.(data.message || `Power command dispatched to ${deviceName}`);
      setSelectedAction(null);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const actionDetails = {
    sleep: {
      title: 'Sleep Workstation',
      desc: 'Puts the PC into low-power sleep state. Background downloads pause until woken.',
      icon: Moon,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    },
    display_off: {
      title: 'Turn Off Display (Screen Sleep)',
      desc: 'Powers off all monitors immediately while keeping the CPU, background tasks, and network running.',
      icon: MonitorOff,
      color: 'text-blue-600 bg-blue-50 border-blue-100',
    },
    restart: {
      title: 'Restart Computer',
      desc: 'Gracefully initiates Windows reboot with a 5-second countdown. Workstation service will auto-start upon boot.',
      icon: RotateCw,
      color: 'text-amber-600 bg-amber-50 border-amber-100',
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/90 backdrop-blur-2xl border border-black/[0.08] rounded-3xl shadow-2xl max-w-md w-full p-6 text-[#1d1d1f] relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 text-[#86868b] hover:text-[#1d1d1f] rounded-full hover:bg-black/[0.04] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-black/[0.04] flex items-center justify-center">
            <Power className="w-5 h-5 text-[#0071e3]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f]">Hardware Power Controls</h3>
            <p className="text-xs text-[#86868b]">{deviceName}</p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Grid */}
        <div className="space-y-2.5 mb-6">
          {(['display_off', 'sleep', 'restart'] as const).map((action) => {
            const item = actionDetails[action];
            const Icon = item.icon;
            const isSelected = selectedAction === action;

            return (
              <div
                key={action}
                onClick={() => setSelectedAction(action)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#0071e3] bg-blue-50/50 shadow-sm ring-1 ring-[#0071e3]'
                    : 'border-black/[0.06] bg-black/[0.02] hover:bg-black/[0.04]'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xs font-semibold text-[#1d1d1f]">{item.title}</h4>
                    <p className="text-xs text-[#86868b] mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Confirm Footer */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-black/[0.08] text-xs font-semibold text-[#1d1d1f] hover:bg-black/[0.03] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedAction || isExecuting}
            onClick={handleExecute}
            className="flex-1 py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {isExecuting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Dispatch Command</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
