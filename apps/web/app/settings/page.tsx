'use client';

import React, { useState } from 'react';
import { Settings, Shield, User, Smartphone, KeyRound, ExternalLink, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const [demoMode, setDemoMode] = useState(true);
  const [mfaReady, setMfaReady] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-cyan-400" />
          Settings & Account Security
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage your security preferences, active sessions, and demo sandboxing
        </p>
      </div>

      {/* Account Profile Card */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-400" />
          Owner Profile
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500">Email Address</span>
            <p className="font-semibold text-slate-200">demo@ilock.security</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500">Account Type</span>
            <p className="font-semibold text-cyan-400">Primary Computer Owner</p>
          </div>
        </div>
      </div>

      {/* Demo Sandbox Mode */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/20 via-slate-900 to-slate-950 border border-emerald-500/30 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Developer & Demo Sandbox Mode
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 max-w-md">
              Allows testing authorization creation, active countdowns, and instant revocation
              without modifying real Windows user credentials.
            </p>
          </div>
          <button
            onClick={() => setDemoMode(!demoMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              demoMode
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {demoMode ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>
      </div>

      {/* Multi-Factor Authentication Architecture */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Two-Factor Authentication (MFA / Passkeys)</h3>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            Passkey Ready
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          iLock database and API schemas are architected for WebAuthn, FIDO2, and iPhone Face ID biometric
          confirmation when approving temporary access requests.
        </p>
        <button
          onClick={() => setMfaReady(!mfaReady)}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
        >
          {mfaReady ? '✓ WebAuthn Device Enrolled' : 'Configure Hardware Passkey / WebAuthn'}
        </button>
      </div>

      {/* Documentation Links */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
        <h3 className="text-sm font-bold text-white">System Documentation</h3>
        <ul className="text-xs text-slate-400 space-y-1.5">
          <li>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:underline flex items-center gap-1"
            >
              Architecture & Threat Model <ExternalLink className="w-3 h-3" />
            </a>
          </li>
          <li>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:underline flex items-center gap-1"
            >
              Windows Agent .NET Service Setup Guide <ExternalLink className="w-3 h-3" />
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
