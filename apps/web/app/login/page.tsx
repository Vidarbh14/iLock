'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Lock,
  Mail,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  Shield,
  Zap,
} from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase-client';
import { CornerOrb } from '@/components/CornerOrb';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setError('Please enter your email address.');
      setIsLoading(false);
      return;
    }

    if (!cleanPassword) {
      setError('Please enter your password.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. Primary path: Server-side login endpoint (sets cookies, immune to adblockers)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Invalid email or password.');
      }

      // 2. Sync client browser Supabase session if session token returned
      if (isConfigured && data.session) {
        try {
          const supabase = createClient();
          await supabase.auth.setSession(data.session);
        } catch (syncErr) {
          console.warn('[Login] Client session sync warning:', syncErr);
        }
      }

      setSuccessMessage('Authenticated successfully! Redirecting...');

      // 3. Full navigation ensures server cookies & fresh session are loaded
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 600);
    } catch (err: any) {
      console.error('[Login] Caught error:', err);

      // Fallback: If server route had network issue, try client-side Supabase login
      if (isConfigured && (err.message?.includes('fetch') || err.message?.includes('network'))) {
        try {
          const supabase = createClient();
          const { data: clientData, error: clientAuthError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPassword,
          });

          if (clientAuthError) throw clientAuthError;

          if (clientData.user) {
            setSuccessMessage('Signed in! Opening dashboard...');
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 600);
            return;
          }
        } catch (clientErr: any) {
          setError(clientErr.message || 'Login failed. Please check credentials.');
          return;
        }
      }

      setError(err.message || 'Login failed. Please verify your email and password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    window.location.href = '/dashboard';
  };

  return (
    <div className="max-w-md mx-auto my-10 px-4 space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-3">
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 mx-auto flex items-center justify-center text-cyan-400 shadow-[0_0_25px_rgba(0,229,255,0.25)]">
          <Shield className="w-8 h-8 text-cyan-400" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Sign In to <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">iLock</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Zero-knowledge workstation access control & remote lock command center
          </p>
        </div>
      </div>

      {!isConfigured && (
        <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Instant Sandbox Mode Active
          </p>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Local demo sandbox mode is active. You can launch instant demo mode or enter any credentials to proceed.
          </p>
        </div>
      )}

      <div className="relative p-7 rounded-3xl glass-card space-y-5 border border-cyber-border overflow-hidden">
        <CornerOrb variant="cyan" />

        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
              Official Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="operator@security.local"
                className="w-full pl-10 pr-3.5 py-2.5 cyber-input text-sm text-slate-100 placeholder-slate-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 font-mono">
                Master Password
              </label>
              <Link href="/forgot-password" className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-10 py-2.5 cyber-input text-sm text-slate-100 placeholder-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Authentication Failed</p>
                <p className="text-[11px] text-rose-400/90 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="flex items-center gap-2.5 p-3.5 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <p className="font-medium">{successMessage}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <span>Sign In to Command Center</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Quick Demo Mode Login */}
          <div className="pt-2 border-t border-cyber-border/60">
            <button
              type="button"
              onClick={handleDemoLogin}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Launch Instant Demo Mode (Vidarbh)
            </button>
          </div>
        </form>
      </div>

      <p className="text-center text-xs text-slate-400">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-cyan-400 hover:text-cyan-300 hover:underline font-semibold">
          Create Account
        </Link>
      </p>
    </div>
  );
}
