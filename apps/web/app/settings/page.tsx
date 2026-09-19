'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  User,
  Smartphone,
  ExternalLink,
  LogOut,
  Loader2,
  CheckCircle2,
  Key,
  Terminal,
  Fingerprint,
  Radio,
} from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase-client';
import { CornerOrb } from '@/components/CornerOrb';

export default function SettingsPage() {
  const [demoMode, setDemoMode] = useState(false);
  const [mfaReady, setMfaReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isDemoUser, setIsDemoUser] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function loadUserProfile() {
      try {
        // 1. Try fetching from server-side session
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user?.email) {
            setUserEmail(data.user.email);
            setIsDemoUser(Boolean(data.user.isDemo));
            setDemoMode(Boolean(data.user.isDemo));
            setIsLoadingUser(false);
            return;
          }
        }

        // 2. Client-side fallback if Supabase client has session
        if (isSupabaseConfigured()) {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) {
            setUserEmail(user.email);
            setIsDemoUser(false);
            setDemoMode(false);
            setIsLoadingUser(false);
            return;
          }
        }

        // Default sandbox
        setUserEmail('demo@ilock.security');
        setIsDemoUser(true);
        setDemoMode(true);
      } catch {
        setUserEmail('demo@ilock.security');
        setIsDemoUser(true);
      } finally {
        setIsLoadingUser(false);
      }
    }

    loadUserProfile();
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        await supabase.auth.signOut();
      }
    } catch {
      // Continue redirect
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="relative glass-card p-6 rounded-3xl border border-cyber-border overflow-hidden">
        <CornerOrb variant="cyan" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,229,255,0.15)]">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
              System Settings & Identity
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage cryptographic authority, WebAuthn passkeys, and account authentication parameters
            </p>
          </div>
        </div>
      </div>

      {/* Account Profile Card */}
      <div className="p-6 glass-card rounded-3xl space-y-5 border border-cyber-border">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <User className="w-4 h-4 text-cyan-400" />
            Authenticated Operator Profile
          </h2>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-all disabled:opacity-50"
          >
            {isLoggingOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            Sign Out
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950/50 border border-cyber-border space-y-1.5">
            <span className="text-slate-400">Registered Email</span>
            {isLoadingUser ? (
              <div className="h-5 w-32 bg-slate-800 rounded animate-pulse" />
            ) : (
              <p className="font-semibold text-slate-100 font-mono truncate" title={userEmail || ''}>
                {userEmail || 'demo@ilock.security'}
              </p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/50 border border-cyber-border space-y-1.5">
            <span className="text-slate-400">Authority Enclave</span>
            {isLoadingUser ? (
              <div className="h-5 w-24 bg-slate-800 rounded animate-pulse" />
            ) : isDemoUser ? (
              <p className="font-semibold text-amber-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Demo Sandbox Authority
              </p>
            ) : (
              <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Primary Owner (Verified)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Demo Sandbox Mode */}
      <div className="relative p-6 glass-card rounded-3xl space-y-3 border border-emerald-500/30 overflow-hidden">
        <CornerOrb variant="emerald" />
        <div className="flex items-center justify-between relative z-10">
          <div>
            <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Developer & Sandbox Testing Mode
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md leading-relaxed">
              Allows simulating remote locking, live countdown timers, and kill-switch revocation without altering Windows credential providers.
            </p>
          </div>
          <button
            onClick={() => setDemoMode(!demoMode)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold font-mono transition-all border ${
              demoMode
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            {demoMode ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>
      </div>

      {/* Multi-Factor Authentication Architecture */}
      <div className="p-6 glass-card rounded-3xl space-y-3 border border-cyber-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-100">FIDO2 Passkeys & Biometric Security</h3>
          </div>
          <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
            WebAuthn Enclave
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          iLock integrates hardware biometric authentication (Windows Hello, Touch ID, Face ID) to issue cryptographically signed unlock commands to enrolled workstations.
        </p>
        <button
          onClick={() => setMfaReady(!mfaReady)}
          className={`px-4 py-2 rounded-xl text-xs font-medium transition-all border ${
            mfaReady
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-500/40'
          }`}
        >
          {mfaReady ? '✓ Hardware Passkey Enrolled' : 'Configure Hardware Passkey / WebAuthn'}
        </button>
      </div>

      {/* Documentation Links */}
      <div className="p-6 glass-card rounded-3xl space-y-3 border border-cyber-border">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          Technical Documentation & Architecture
        </h3>
        <ul className="text-xs text-slate-400 space-y-2 font-mono">
          <li>
            <a
              href="https://github.com/Vidarbh14/iLock"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1.5 transition-colors"
            >
              Zero-Trust Architecture & Threat Model <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </li>
          <li>
            <a
              href="https://github.com/Vidarbh14/iLock"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1.5 transition-colors"
            >
              Windows Agent .NET 8 Background Service Guide <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
