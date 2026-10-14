'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Copy,
  Check,
  RefreshCw,
  Clock,
  X,
  KeyRound,
  WifiOff,
} from 'lucide-react';

interface EmergencyTotpModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
}

export function EmergencyTotpModal({
  isOpen,
  onClose,
  deviceId,
  deviceName,
}: EmergencyTotpModalProps) {
  const [code, setCode] = useState<string>('------');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTotp = async () => {
    try {
      const res = await fetch(`/api/devices/${deviceId}/totp`);
      const data = await res.json();
      if (data?.code) {
        setCode(data.code);
        setSecondsRemaining(data.secondsRemaining ?? 30);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchTotp();
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          fetchTotp();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, deviceId]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-2xl border border-black/[0.08] rounded-3xl shadow-2xl max-w-md w-full p-6 text-[#1d1d1f] relative">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 text-[#86868b] hover:text-[#1d1d1f] rounded-full hover:bg-black/[0.04] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
            <WifiOff className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f]">Offline Emergency Key</h3>
            <p className="text-xs text-[#86868b]">{deviceName}</p>
          </div>
        </div>

        <p className="text-xs text-[#86868b] mb-6 leading-relaxed">
          If your Wi-Fi or home internet is disconnected, this time-synchronized rolling 6-digit key allows emergency access without any internet connection.
        </p>

        {/* 6-Digit Code Box */}
        <div className="p-6 rounded-2xl bg-black/[0.03] border border-black/[0.06] flex flex-col items-center justify-center mb-5 relative overflow-hidden">
          <div className="text-3xl font-mono font-bold tracking-[0.3em] text-[#1d1d1f] mb-3 select-all">
            {code.slice(0, 3)} {code.slice(3)}
          </div>

          {/* 30s Countdown Bar */}
          <div className="w-full max-w-[200px] h-1.5 bg-black/[0.06] rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-[#0071e3] transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${(secondsRemaining / 30) * 100}%` }}
            />
          </div>

          <div className="text-[11px] text-[#86868b] flex items-center gap-1.5 font-medium">
            <Clock className="w-3 h-3 text-[#0071e3]" />
            <span>Refreshes in {secondsRemaining}s</span>
          </div>
        </div>

        {/* Copy Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 rounded-xl bg-black/[0.04] hover:bg-black/[0.07] text-[#1d1d1f] text-xs font-semibold border border-black/[0.06] transition-all flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#86868b]" />
                <span>Copy 6-Digit Code</span>
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-5 rounded-xl bg-[#0071e3] text-white text-xs font-semibold hover:bg-[#0077ed] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
