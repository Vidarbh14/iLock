'use client';

import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Unlock,
  Smartphone,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { Device } from '@ilock/shared';
import { CornerOrb } from './CornerOrb';

interface Props {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BiometricUnlockModal({ device, isOpen, onClose, onSuccess }: Props) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricSupported, setBiometricSupported] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => setBiometricSupported(available))
        .catch(() => setBiometricSupported(false));
    } else {
      setBiometricSupported(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setAuthSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen || !device) return null;

  const triggerBiometricAuth = async () => {
    setIsAuthenticating(true);
    setError(null);

    let biometricVerified = false;

    // Check if WebAuthn is supported
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        // Request local biometric credential evaluation (Face ID / Fingerprint)
        const credential = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: {
              name: 'iLock Mobile Authenticator',
              id: window.location.hostname,
            },
            user: {
              id: Uint8Array.from([1, 2, 3, 4]),
              name: 'owner@ilock.security',
              displayName: 'Device Owner',
            },
            pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
            },
            timeout: 60000,
          },
        });

        if (credential) {
          biometricVerified = true;
        }
      } catch (err: any) {
        console.warn('Biometric challenge skipped or cancelled:', err);
      }
    }

    try {
      const res = await fetch(`/api/devices/${device.id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ biometricVerified }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Remote unlock command dispatch failed');
      }

      setAuthSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Unlock dispatch failed. Verify internet connection.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-md glass-modal p-6 shadow-2xl space-y-6 relative overflow-hidden border border-white/[0.1]">
        {/* Corner Orbs */}
        <CornerOrb position="top-right" variant="emerald" size="sm" active />
        <CornerOrb position="bottom-left" variant="cyan" size="sm" active />

        {/* Modal Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#10b981]/15 border border-[#10b981]/30 text-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#f0f3f6]">Remote Biometric Unlock</h3>
              <p className="text-xs text-[#8b949e] font-mono">{device.deviceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/[0.08] text-[#8b949e] hover:text-[#f0f3f6] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Biometric Scanner Target */}
        <div className="text-center py-6 space-y-4 relative z-10">
          <div className="relative inline-flex items-center justify-center">
            {/* Radar Pulse Rings */}
            <div
              className={`absolute w-32 h-32 rounded-full border border-[#00e5ff]/20 animate-ping opacity-30 ${
                isAuthenticating ? 'duration-700' : 'duration-1000'
              }`}
            />
            <div className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-[#0066ff]/15 to-[#00e5ff]/15 blur-xl" />

            {/* Center Biometric Target Button */}
            <button
              onClick={triggerBiometricAuth}
              disabled={isAuthenticating || authSuccess}
              className={`relative z-10 w-24 h-24 rounded-3xl flex flex-col items-center justify-center transition-all duration-300 shadow-2xl border ${
                authSuccess
                  ? 'bg-[#10b981]/25 border-[#10b981] text-[#34d399] shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-105'
                  : isAuthenticating
                  ? 'bg-[#0066ff]/25 border-[#00e5ff] text-[#00e5ff] shadow-[0_0_30px_rgba(0,229,255,0.4)] animate-pulse'
                  : 'bg-white/[0.05] border-white/[0.15] text-[#f0f3f6] hover:border-[#00e5ff]/60 hover:text-[#00e5ff] hover:scale-105'
              }`}
            >
              {authSuccess ? (
                <CheckCircle2 className="w-10 h-10 text-[#34d399] animate-bounce" />
              ) : isAuthenticating ? (
                <Loader2 className="w-10 h-10 text-[#00e5ff] animate-spin" />
              ) : (
                <Fingerprint className="w-10 h-10" />
              )}
            </button>
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-[#f0f3f6]">
              {authSuccess
                ? 'Authorization Granted! Workstation Unlocked'
                : isAuthenticating
                ? 'Evaluating Biometric Authorization...'
                : 'Touch to Authorize Unlock'}
            </h4>
            <p className="text-xs text-[#8b949e] max-w-xs mx-auto font-mono">
              {authSuccess
                ? 'Secured session restored on target computer'
                : biometricSupported
                ? 'Uses your phone fingerprint / Face ID platform authenticator'
                : 'Sends signed owner unlock command to Windows Agent'}
            </p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 text-xs bg-[#f43f5e]/15 border border-[#f43f5e]/30 text-[#fb7185] rounded-2xl animate-shake">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="space-y-2 relative z-10">
          <button
            onClick={triggerBiometricAuth}
            disabled={isAuthenticating || authSuccess}
            className="w-full py-3 rounded-full text-xs font-semibold text-white apple-btn-primary disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Biometric Key...</span>
              </>
            ) : authSuccess ? (
              <>
                <Unlock className="w-4 h-4" />
                <span>Workstation Unlocked</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Authorize with Phone Sensor</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
