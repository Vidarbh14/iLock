'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Bell, Volume2, VolumeX, X, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

interface ToastAlert {
  id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning';
}

interface AudioNotificationContextType {
  playChime: () => void;
  showNotification: (title: string, message: string, type?: 'info' | 'success' | 'warning') => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

const AudioNotificationContext = createContext<AudioNotificationContextType>({
  playChime: () => {},
  showNotification: () => {},
  soundEnabled: true,
  setSoundEnabled: () => {},
});

export const useAudioNotification = () => useContext(AudioNotificationContext);

export function AudioNotificationProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alerts, setAlerts] = useState<ToastAlert[]>([]);

  // Synthesize crisp Apple-like 2-tone chime via Web Audio API (no external mp3 files needed)
  const playChime = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      // Crisp harmonic chime (C6 -> G6)
      playTone(1046.5, 0.0, 0.22);
      playTone(1567.98, 0.12, 0.35);
    } catch {
      // AudioContext might be blocked until user interacts with the page
    }
  }, [soundEnabled]);

  const showNotification = useCallback((title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    playChime();
    const id = Math.random().toString(36).substring(2, 9);
    setAlerts((prev) => [...prev, { id, title, message, type }]);

    setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    }, 5000);
  }, [playChime]);

  const removeAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <AudioNotificationContext.Provider value={{ playChime, showNotification, soundEnabled, setSoundEnabled }}>
      {children}

      {/* Floating In-App Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="pointer-events-auto bg-white/95 backdrop-blur-xl border border-black/[0.08] shadow-2xl rounded-2xl p-4 flex items-start gap-3 transform transition-all duration-300 animate-in fade-in slide-in-from-top-3"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                alert.type === 'success'
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  : alert.type === 'warning'
                  ? 'bg-amber-50 text-amber-600 border border-amber-100'
                  : 'bg-blue-50 text-[#0071e3] border border-blue-100'
              }`}
            >
              {alert.type === 'success' ? (
                <ShieldCheck className="w-5 h-5" />
              ) : alert.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-[#1d1d1f]">{alert.title}</h4>
              <p className="text-xs text-[#86868b] mt-0.5 leading-relaxed">{alert.message}</p>
            </div>

            <button
              onClick={() => removeAlert(alert.id)}
              className="text-[#86868b] hover:text-[#1d1d1f] p-1 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </AudioNotificationContext.Provider>
  );
}
