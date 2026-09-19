'use client';

import React, { useState } from 'react';
import { Laptop, Copy, Check, X, Shield, Terminal, ArrowRight, KeyRound } from 'lucide-react';
import { CornerOrb } from './CornerOrb';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-lg glass-modal p-6 shadow-2xl space-y-5 relative overflow-hidden border border-white/[0.1]">
        <CornerOrb position="top-right" variant="cyan" size="sm" active />
        <CornerOrb position="bottom-left" variant="blue" size="sm" active />

        {/* Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#0066ff]/15 border border-[#0066ff]/30 text-[#00e5ff] shadow-[0_0_15px_rgba(0,102,255,0.3)]">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#f0f3f6]">Enroll Windows Machine</h3>
              <p className="text-xs text-[#8b949e] font-mono">Asymmetric Cryptographic Handshake</p>
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
          <div className="p-3 text-xs bg-[#f43f5e]/15 border border-[#f43f5e]/30 text-[#fb7185] rounded-2xl">
            {error}
          </div>
        )}

        {!pairingData ? (
          <form onSubmit={handleGenerate} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-1.5">
                Computer Label / Identification
              </label>
              <input
                type="text"
                required
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g., Work ThinkPad X1, Gaming Rig"
                className="w-full apple-input px-3.5 py-2.5 text-sm text-[#f0f3f6]"
              />
              <p className="text-[11px] text-[#8b949e] mt-1 font-mono">
                Give this workstation a recognizable identifier in your Command Center.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-1.5 text-xs text-[#8b949e]">
              <div className="flex items-center gap-2 text-[#00e5ff] font-semibold">
                <Shield className="w-4 h-4" />
                <span>Zero-Knowledge Hardware Enrollment</span>
              </div>
              <p className="leading-relaxed">
                Your Windows PC locally generates an unextractable 4096-bit RSA keypair. Only the public key is transmitted to the cloud. Your personal Windows credentials are never collected.
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
                className="px-5 py-2 text-xs font-semibold apple-btn-primary rounded-full disabled:opacity-50 flex items-center gap-1.5"
              >
                {isGenerating ? 'Enrolling...' : 'Generate Pairing Key'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4 relative z-10">
            {/* Pairing Code Big Banner */}
            <div className="text-center p-6 rounded-3xl bg-gradient-to-b from-[#0066ff]/10 to-[#00e5ff]/5 border border-[#00e5ff]/30 shadow-[0_0_25px_rgba(0,229,255,0.15)] relative overflow-hidden">
              <span className="text-xs uppercase tracking-widest text-[#00e5ff] font-mono font-semibold">
                One-Time Cryptographic Handshake Code
              </span>
              <div className="mt-3 flex items-center justify-center gap-3">
                <span className="font-mono text-3xl font-bold text-[#f0f3f6] tracking-widest selection:bg-[#00e5ff] selection:text-black">
                  {pairingData.pairingCode}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(pairingData.pairingCode)}
                  className="p-2 rounded-full apple-btn-secondary"
                  title="Copy Pairing Code"
                >
                  {copied ? <Check className="w-4 h-4 text-[#10b981]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-[#8b949e] mt-2 font-mono">
                Valid for 10 minutes • Single-use only • Cryptographically protected
              </p>
            </div>

            {/* Instruction Steps */}
            <div className="space-y-2 text-xs">
              <span className="text-[#f0f3f6] font-semibold">On your Windows PC:</span>
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/[0.08] space-y-2 font-mono">
                <div className="flex items-center gap-2 text-[#00e5ff]">
                  <Terminal className="w-4 h-4" />
                  <span className="text-[11px]">Run in PowerShell (Admin):</span>
                </div>
                <div className="flex items-center justify-between bg-[#08090d] px-3 py-2 rounded-xl text-[#00e5ff] text-[11px] border border-white/[0.08]">
                  <code className="font-mono truncate">iLock.WindowsAgent.exe --pair {pairingData.pairingCode}</code>
                  <button
                    onClick={() =>
                      handleCopy(`iLock.WindowsAgent.exe --pair ${pairingData.pairingCode}`)
                    }
                    className="ml-2 text-[#8b949e] hover:text-[#f0f3f6] shrink-0"
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
                className="text-xs text-[#8b949e] hover:text-[#f0f3f6] font-mono transition-colors"
              >
                ← Generate another code
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeviceRegistered();
                  onClose();
                }}
                className="px-5 py-2 text-xs font-semibold apple-btn-primary rounded-full"
              >
                Done / Refresh Console
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
