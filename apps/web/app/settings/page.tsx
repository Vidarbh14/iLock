'use client';

import React, { useState } from 'react';
import { Settings, Shield, User, Smartphone, KeyRound, ExternalLink, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const [demoMode, setDemoMode] = useState(true);
  const [mfaReady, setMfaReady] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#0071e3]" />
          Settings & Account Security
        </h1>
        <p className="text-xs text-[#6e6e73] mt-0.5">
          Manage your security preferences, active sessions, and demo sandboxing
        </p>
      </div>

      {/* Account Profile Card */}
      <div className="p-5 glass-card space-y-3">
        <h2 className="text-sm font-semibold text-[#1d1d1f] flex items-center gap-2">
          <User className="w-4 h-4 text-[#0071e3]" />
          Owner Profile
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/[0.06] space-y-1">
            <span className="text-[#6e6e73]">Email Address</span>
            <p className="font-semibold text-[#1d1d1f]">demo@ilock.security</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/[0.06] space-y-1">
            <span className="text-[#6e6e73]">Account Type</span>
            <p className="font-semibold text-[#0071e3]">Primary Computer Owner</p>
          </div>
        </div>
      </div>

      {/* Demo Sandbox Mode */}
      <div className="p-5 glass-card space-y-3 border border-[#34c759]/25">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#248a3d] flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Developer & Demo Sandbox Mode
            </h3>
            <p className="text-xs text-[#6e6e73] mt-0.5 max-w-md">
              Allows testing authorization creation, active countdowns, and instant revocation
              without modifying real Windows user credentials.
            </p>
          </div>
          <button
            onClick={() => setDemoMode(!demoMode)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              demoMode
                ? 'bg-[#34c759]/15 text-[#248a3d] border-[#34c759]/40 shadow-[0_0_12px_rgba(52,199,89,0.2)]'
                : 'apple-btn-secondary'
            }`}
          >
            {demoMode ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>
      </div>

      {/* Multi-Factor Authentication Architecture */}
      <div className="p-5 glass-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#0071e3]" />
            <h3 className="text-sm font-semibold text-[#1d1d1f]">Two-Factor Authentication (MFA / Passkeys)</h3>
          </div>
          <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] border border-[#0071e3]/20">
            Passkey Ready
          </span>
        </div>
        <p className="text-xs text-[#6e6e73] leading-relaxed">
          iLock database and API schemas are architected for WebAuthn, FIDO2, and iPhone Face ID biometric
          confirmation when approving temporary access requests.
        </p>
        <button
          onClick={() => setMfaReady(!mfaReady)}
          className="px-4 py-2 rounded-full text-xs font-medium apple-btn-secondary transition-colors"
        >
          {mfaReady ? '✓ WebAuthn Device Enrolled' : 'Configure Hardware Passkey / WebAuthn'}
        </button>
      </div>

      {/* Documentation Links */}
      <div className="p-5 glass-card space-y-2">
        <h3 className="text-sm font-semibold text-[#1d1d1f]">System Documentation</h3>
        <ul className="text-xs text-[#6e6e73] space-y-1.5">
          <li>
            <a
              href="https://github.com/Vidarbh14/iLock"
              target="_blank"
              rel="noreferrer"
              className="text-[#0071e3] hover:underline flex items-center gap-1 font-medium"
            >
              Architecture & Threat Model <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>
            <a
              href="https://github.com/Vidarbh14/iLock"
              target="_blank"
              rel="noreferrer"
              className="text-[#0071e3] hover:underline flex items-center gap-1 font-medium"
            >
              Windows Agent .NET Service Setup Guide <ExternalLink className="w-3 h-3" />
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
