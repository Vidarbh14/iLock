'use client';

import React, { useState } from 'react';
import { Laptop, Copy, Check, X, Shield, Terminal, ArrowRight } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDeviceRegistered: () => void;
}

export function PairDeviceModal({ isOpen, onClose, onDeviceRegistered }: Props) {
  const [deviceName, setDeviceName] = useState('');
  const [pairingData, setPairingData] = useState<{
    pairingCode: string;
    expiresInSeconds: number;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) {
      setError('Please provide a name for this computer');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/devices/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceName: deviceName.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.pairingCode) {
        throw new Error(data.error?.message || 'Failed to generate pairing code');
      }

      setPairingData(data);
    } catch (err: any) {
      setError(err.message || 'Could not initiate pairing session');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg glass-modal p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#0071e3]/10 border border-[#0071e3]/20 text-[#0071e3] shadow-[0_0_12px_rgba(0,113,227,0.15)]">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">Register Windows PC</h3>
              <p className="text-xs text-[#6e6e73]">Asymmetric Cryptographic Enrollment</p>
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
          <div className="p-3 text-xs bg-[#ff3b30]/10 border border-[#ff3b30]/25 text-[#ff3b30] rounded-2xl backdrop-blur-md">
            {error}
          </div>
        )}

        {!pairingData ? (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                Computer Name / Label
              </label>
              <input
                type="text"
                required
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Vidarbh's Laptop or Desktop"
                className="w-full apple-input px-3.5 py-2.5 text-sm font-normal"
              />
              <p className="text-[11px] text-[#6e6e73] mt-1">
                Give this machine a recognizable label.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/[0.06] space-y-1.5 text-xs text-[#6e6e73]">
              <div className="flex items-center gap-2 text-[#1d1d1f] font-semibold">
                <Shield className="w-4 h-4 text-[#0071e3]" />
                Zero-Knowledge Device Pairing
              </div>
              <p className="leading-relaxed">
                Your Windows PC will locally generate a 4096-bit RSA keypair. Only the public key will be
                registered. Your Windows login password is never collected or transmitted.
              </p>
            </div>

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
                disabled={isGenerating}
                className="px-5 py-2 text-xs font-medium apple-btn-primary rounded-full disabled:opacity-50 flex items-center gap-1.5"
              >
                {isGenerating ? 'Generating...' : 'Generate Pairing Code'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Pairing Code Big Banner */}
            <div className="text-center p-6 rounded-3xl bg-[#0071e3]/[0.04] border border-[#0071e3]/20 shadow-sm relative overflow-hidden">
              <span className="text-xs uppercase tracking-widest text-[#0071e3] font-mono font-medium">
                One-Time Pairing Code
              </span>
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="font-mono text-3xl font-bold text-[#1d1d1f] tracking-widest selection:bg-[#0071e3] selection:text-white">
                  {pairingData.pairingCode}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(pairingData.pairingCode)}
                  className="p-2 rounded-full apple-btn-secondary"
                  title="Copy Pairing Code"
                >
                  {copied ? <Check className="w-4 h-4 text-[#34c759]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-[#6e6e73] mt-2">
                Valid for 10 minutes • Single use only • Cryptographically protected
              </p>
            </div>

            {/* Instruction Steps */}
            <div className="space-y-2 text-xs">
              <span className="text-[#1d1d1f] font-medium">On your Windows PC:</span>
              <div className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/[0.06] space-y-2 font-mono">
                <div className="flex items-center gap-2 text-[#0071e3]">
                  <Terminal className="w-4 h-4" />
                  <span>Run in PowerShell / Terminal:</span>
                </div>
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl text-[#1d1d1f] text-[11px] border border-black/[0.08] shadow-sm">
                  <code className="text-[#0071e3] font-semibold">ILock.WindowsAgent.exe --pair {pairingData.pairingCode}</code>
                  <button
                    onClick={() =>
                      handleCopy(`ILock.WindowsAgent.exe --pair ${pairingData.pairingCode}`)
                    }
                    className="ml-2 text-[#6e6e73] hover:text-[#1d1d1f]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setPairingData(null)}
                className="text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition-colors"
              >
                Generate another code
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeviceRegistered();
                  onClose();
                }}
                className="px-5 py-2 text-xs font-medium apple-btn-primary rounded-full"
              >
                Done / Refresh Devices
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
