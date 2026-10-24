'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  X,
  Camera,
  Zap,
  Bell,
  Volume2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  Eye,
  Lock,
} from 'lucide-react';

interface SentryModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
}

interface IntruderAlert {
  id: string;
  created_at: string;
  reason: string;
  details?: {
    photoBase64?: string;
    timestamp?: number;
    reason?: string;
  };
}

export function SentryModal({
  isOpen,
  onClose,
  deviceId,
  deviceName,
}: SentryModalProps) {
  const [isArmed, setIsArmed] = useState(false);
  const [alarmOnTamper, setAlarmOnTamper] = useState(false);
  const [snapOnLogon, setSnapOnLogon] = useState(true);
  const [alertOnPower, setAlertOnPower] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [alerts, setAlerts] = useState<IntruderAlert[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`/api/devices/${deviceId}/sentry`);
      const data = await res.json();
      if (res.ok && data.alerts) {
        setAlerts(data.alerts);
      }
    } catch {}
  };

  const handleSaveConfig = async (armedOverride?: boolean) => {
    setIsLoading(true);
    setStatusMessage(null);
    const armState = armedOverride !== undefined ? armedOverride : isArmed;

    try {
      const res = await fetch(`/api/devices/${deviceId}/sentry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: armState,
          alarmOnTamper,
          snapOnFailedLogon: snapOnLogon,
          alertOnPowerDisconnect: alertOnPower,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsArmed(armState);
        setStatusMessage({
          type: 'success',
          text: `Sentry Mode ${armState ? 'Armed & Active' : 'Disarmed'}`,
        });
        setTimeout(fetchAlerts, 1500);
      } else {
        setStatusMessage({ type: 'error', text: data.error?.message || 'Failed to update sentry guard' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to configure sentry guard' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      fetchAlerts();
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, deviceId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto overscroll-contain">
      <div className="relative w-full max-w-2xl bg-cyber-card border border-cyber-border rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto overscroll-contain my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyber-border">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                isArmed
                  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                  : 'bg-slate-800/60 border border-slate-700/60 text-slate-400'
              }`}
            >
              {isArmed ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Sentry Mode & Intruder Guard
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    isArmed
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700'
                  }`}
                >
                  {isArmed ? 'ARMED' : 'STANDBY'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {deviceName} • Silent Webcam Surveillance & Anti-Theft
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

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Armed Master Toggle Box */}
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 to-slate-950 border border-cyber-border flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              Sentry Surveillance Armed
            </h4>
            <p className="text-xs text-slate-400">
              When armed, PC actively monitors for physical tampering, unplugging, or failed logons.
            </p>
          </div>

          <button
            onClick={() => handleSaveConfig(!isArmed)}
            disabled={isLoading}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 ${
              isArmed
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(0,229,255,0.2)]'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            {isArmed ? 'Disarm Sentry' : 'Arm Sentry'}
          </button>
        </div>

        {/* Feature Triggers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          <div
            onClick={() => {
              setAlertOnPower(!alertOnPower);
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              alertOnPower
                ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                : 'bg-slate-900/40 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Zap className="w-4 h-4 text-cyan-400" />
              <input
                type="checkbox"
                checked={alertOnPower}
                onChange={(e) => setAlertOnPower(e.target.checked)}
                className="accent-cyan-400 cursor-pointer"
              />
            </div>
            <p className="text-xs font-semibold text-white">AC Snatch Lock</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Auto-lock & webcam snap if charger is yanked
            </p>
          </div>

          <div
            onClick={() => setSnapOnLogon(!snapOnLogon)}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              snapOnLogon
                ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                : 'bg-slate-900/40 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Camera className="w-4 h-4 text-emerald-400" />
              <input
                type="checkbox"
                checked={snapOnLogon}
                onChange={(e) => setSnapOnLogon(e.target.checked)}
                className="accent-cyan-400 cursor-pointer"
              />
            </div>
            <p className="text-xs font-semibold text-white">Logon Snap</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Silent photo on failed lockscreen login
            </p>
          </div>

          <div
            onClick={() => setAlarmOnTamper(!alarmOnTamper)}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              alarmOnTamper
                ? 'bg-amber-500/10 border-amber-500/40 text-white'
                : 'bg-slate-900/40 border-slate-800 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Volume2 className="w-4 h-4 text-amber-400" />
              <input
                type="checkbox"
                checked={alarmOnTamper}
                onChange={(e) => setAlarmOnTamper(e.target.checked)}
                className="accent-amber-400 cursor-pointer"
              />
            </div>
            <p className="text-xs font-semibold text-white">Audio Alarm</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              100dB acoustic deterrent siren on breach
            </p>
          </div>
        </div>

        {/* Intruder Captures Section */}
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            Surveillance Snapshots & Alerts
          </h4>
          <button
            onClick={fetchAlerts}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh Logs
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar overscroll-contain touch-pan-y min-h-[140px]">
          {alerts.length === 0 ? (
            <div className="text-center py-8 rounded-xl bg-slate-900/40 border border-slate-800/80 text-slate-500 text-xs font-mono">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              No tamper incidents recorded. System secure.
            </div>
          ) : (
            alerts.map((al) => {
              const photo = al.details?.photoBase64;
              return (
                <div
                  key={al.id}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {photo ? (
                      <div
                        onClick={() => setSelectedPhoto(photo)}
                        className="w-12 h-12 rounded-lg overflow-hidden border border-cyan-500/40 cursor-pointer shrink-0 relative group"
                      >
                        <img
                          src={photo}
                          alt="Intruder Snapshot"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                        <Camera className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-rose-300 truncate">
                        {al.reason || al.details?.reason || 'Intruder Alert'}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {new Date(al.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {photo && (
                    <button
                      onClick={() => setSelectedPhoto(photo)}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-mono shrink-0"
                    >
                      View Photo
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Photo Zoom Overlay */}
        {selectedPhoto && (
          <div
            onClick={() => setSelectedPhoto(null)}
            className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-fade-in"
          >
            <div className="relative max-w-xl w-full bg-slate-950 p-2 rounded-2xl border border-cyan-500/40 shadow-2xl">
              <img
                src={selectedPhoto}
                alt="Intruder Full"
                className="w-full h-auto rounded-xl object-contain max-h-[75vh]"
              />
              <div className="p-3 text-center">
                <p className="text-xs text-slate-300 font-mono">
                  Silent Webcam Intruder Snapshot
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Click anywhere to close</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-cyber-border flex items-center justify-end gap-2">
          <button
            onClick={() => handleSaveConfig()}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Save Trigger Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
