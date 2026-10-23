'use client';

import React, { useState, useEffect } from 'react';
import {
  Bluetooth,
  X,
  Shield,
  Signal,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Sliders,
  Smartphone,
} from 'lucide-react';

interface BleProximityModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
}

export function BleProximityModal({
  isOpen,
  onClose,
  deviceId,
  deviceName,
}: BleProximityModalProps) {
  const [enabled, setEnabled] = useState(false);
  const [rssiThreshold, setRssiThreshold] = useState(-75);
  const [timeoutSeconds, setTimeoutSeconds] = useState(5);
  const [deviceAddress, setDeviceAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProximity = async () => {
    try {
      const res = await fetch(`/api/devices/${deviceId}/proximity`);
      const data = await res.json();
      if (res.ok && data.proximity) {
        setEnabled(!!data.proximity.enabled);
        setRssiThreshold(data.proximity.rssiThreshold ?? -75);
        setTimeoutSeconds(data.proximity.timeoutSeconds ?? 5);
        setDeviceAddress(data.proximity.deviceAddress ?? '');
      }
    } catch {}
  };

  const handleSave = async (overrideEnabled?: boolean) => {
    setIsLoading(true);
    setMessage(null);
    const newEnabled = overrideEnabled !== undefined ? overrideEnabled : enabled;

    try {
      const res = await fetch(`/api/devices/${deviceId}/proximity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: newEnabled,
          rssiThreshold,
          timeoutSeconds,
          deviceAddress,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setEnabled(newEnabled);
        setMessage({
          type: 'success',
          text: `BLE Walk-Away Proximity ${newEnabled ? 'Activated' : 'Deactivated'}`,
        });
      } else {
        setMessage({ type: 'error', text: data.error?.message || 'Failed to update proximity' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update proximity' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProximity();
    }
  }, [isOpen, deviceId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-cyber-card border border-cyber-border rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyber-border">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                enabled
                  ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                  : 'bg-slate-800/60 border border-slate-700/60 text-slate-400'
              }`}
            >
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                BLE Walk-Away Proximity
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    enabled
                      ? 'bg-blue-500/10 text-blue-300 border-blue-500/30 animate-pulse'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700'
                  }`}
                >
                  {enabled ? 'ACTIVE' : 'DISABLED'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {deviceName} • Zero-Touch Auto-Lock On Signal Fade
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Master Toggle Banner */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 to-slate-950 border border-cyber-border flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-400" />
              Walk-Away Auto Lock
            </h4>
            <p className="text-xs text-slate-400">
              When you step away with your phone, workstation locks immediately.
            </p>
          </div>

          <button
            onClick={() => handleSave(!enabled)}
            disabled={isLoading}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 ${
              enabled
                ? 'bg-blue-500 hover:bg-blue-400 text-black shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <Bluetooth className="w-4 h-4" />
            {enabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        {/* Proximity Parameters */}
        <div className="space-y-4 my-5">
          {/* RSSI Sensitivity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Signal className="w-3.5 h-3.5 text-blue-400" />
                Distance Sensitivity (RSSI Threshold)
              </span>
              <span className="font-mono text-cyan-400 font-bold">{rssiThreshold} dBm</span>
            </div>
            <input
              type="range"
              min="-95"
              max="-50"
              step="5"
              value={rssiThreshold}
              onChange={(e) => setRssiThreshold(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>Far Range (-95 dBm)</span>
              <span>Medium (-75 dBm)</span>
              <span>Close Range (-50 dBm)</span>
            </div>
          </div>

          {/* Grace Timeout */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Walk-Away Grace Period
              </span>
              <span className="font-mono text-cyan-400 font-bold">{timeoutSeconds} Seconds</span>
            </div>
            <input
              type="range"
              min="2"
              max="20"
              step="1"
              value={timeoutSeconds}
              onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>Instant (2s)</span>
              <span>Default (5s)</span>
              <span>Relaxed (20s)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-cyber-border flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5" /> Paired phone beacon detected
          </span>
          <button
            onClick={() => handleSave()}
            disabled={isLoading}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
