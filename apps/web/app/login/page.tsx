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
} from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase-client';

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
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-3xl bg-white border border-black/[0.08] mx-auto flex items-center justify-center text-[#0071e3] shadow-sm">
          <Lock className="w-7 h-7 text-[#0071e3]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Sign In to iLock</h1>
        <p className="text-xs text-[#6e6e73]">
          Zero-knowledge remote authorization & lock control for your Windows PC
        </p>
      </div>

      {!isConfigured && (
        <div className="p-3.5 rounded-2xl bg-[#0071e3]/10 border border-[#0071e3]/20 text-xs text-[#0071e3] space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0071e3] animate-pulse" />
            Instant Sandbox Mode Active
          </p>
          <p className="text-[#6e6e73] text-[11px]">
            Supabase is in local sandbox mode. You can click &quot;Launch Instant Demo Mode&quot; below or enter any credentials to proceed.
          </p>
        </div>
      )}

      <div className="p-7 rounded-3xl glass-card space-y-5 shadow-sm border border-black/[0.06]">
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">Official Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[#86868b]" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="your.name@company.com"
                className="w-full pl-10 pr-3.5 py-2.5 apple-input text-sm text-[#1d1d1f]"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#1d1d1f]">Password</label>
              <Link href="/forgot-password" className="text-[11px] text-[#0071e3] hover:underline font-medium">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-[#86868b]" />
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
                className="w-full pl-10 pr-10 py-2.5 apple-input text-sm text-[#1d1d1f]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Banner - Directly above the submit button */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 text-xs bg-[#ff3b30]/10 border border-[#ff3b30]/25 text-[#ff3b30] rounded-2xl animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Sign In Failed</p>
                <p className="text-[11px] text-[#ff3b30]/90 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="flex items-center gap-2.5 p-3.5 text-xs bg-[#34c759]/10 border border-[#34c759]/25 text-[#248a3d] rounded-2xl">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#34c759]" />
              <p className="font-medium">{successMessage}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-full text-xs font-semibold text-white apple-btn-primary disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Quick Demo Mode Login */}
          <div className="pt-2 border-t border-black/[0.06]">
            <button
              type="button"
              onClick={handleDemoLogin}
              className="w-full py-2.5 rounded-full text-xs font-medium text-[#248a3d] bg-[#34c759]/10 hover:bg-[#34c759]/20 border border-[#34c759]/30 transition-colors flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              Launch Instant Demo Mode (Vidarbh)
            </button>
          </div>
        </form>
      </div>

      <p className="text-center text-xs text-[#6e6e73]">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-[#0071e3] hover:underline font-semibold">
          Create Account
        </Link>
      </p>
    </div>
  );
}
