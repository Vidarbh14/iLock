'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Mail,
  KeyRound,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase-client';
import { CornerOrb } from '@/components/CornerOrb';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  // Real-time validations
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isPasswordLongEnough = password.length >= 8;
  const doPasswordsMatch = password.length > 0 && password === confirmPassword;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !isEmailValid) {
      setError('Please enter a valid email address.');
      return;
    }

    if (cleanPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (cleanPassword !== confirmPassword.trim()) {
      setError('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Primary path: Server-side registration endpoint (immune to client-side adblockers)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Registration failed. Please try again.');
      }

      // 2. Sync client-side browser Supabase instance if configured & session returned
      if (isConfigured && data.session) {
        try {
          const supabase = createClient();
          await supabase.auth.setSession(data.session);
        } catch (syncErr) {
          console.warn('[Signup] Client session sync warning:', syncErr);
        }
      }

      setSuccessMessage('Account registered successfully! Opening dashboard...');

      // 3. Full navigation ensures server cookies & fresh session are loaded
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 700);
    } catch (err: any) {
      console.error('[Signup] Error caught:', err);

      // Fallback: If server endpoint returned an error or failed network, attempt client-side Supabase signup
      if (isConfigured && (err.message?.includes('fetch') || err.message?.includes('network'))) {
        try {
          const supabase = createClient();
          const { data: clientData, error: clientAuthError } = await supabase.auth.signUp({
            email: cleanEmail,
            password: cleanPassword,
          });

          if (clientAuthError) throw clientAuthError;

          if (clientData.user) {
            setSuccessMessage('Account created! Redirecting to your dashboard...');
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 700);
            return;
          }
        } catch (clientErr: any) {
          setError(clientErr.message || 'Registration failed. Check your network.');
          return;
        }
      }

      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoAccess = () => {
    window.location.href = '/dashboard';
  };

  return (
    <div className="max-w-md mx-auto my-10 px-4 space-y-6">
      {/* Brand Header (Requirement 1: entry-seq-1) */}
      <div className="entry-seq-1 text-center space-y-3">
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 mx-auto flex items-center justify-center text-cyan-400 shadow-[0_0_25px_rgba(0,229,255,0.25)]">
          <Shield className="w-8 h-8 text-cyan-400" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Create Owner Account
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Register your official credentials to remotely manage, lock, and unlock your Windows PC
          </p>
        </div>
      </div>

      {!isConfigured && (
        <div className="entry-seq-2 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Instant Sandbox Mode Active
          </p>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Local sandbox mode is active. You can register with any credentials to immediately test all features.
          </p>
        </div>
      )}

      {/* Main Registration Card (Requirement 1: entry-seq-2) */}
      <div className="entry-seq-2 relative p-7 rounded-3xl glass-card space-y-5 border border-cyber-border overflow-hidden">
        <CornerOrb variant="cyan" />

        <form onSubmit={handleSignup} className="space-y-4 relative z-10">
          {/* Email Field */}
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
                placeholder="your.name@company.com"
                className={`w-full pl-10 pr-10 py-2.5 cyber-input text-sm text-slate-100 placeholder-slate-500 transition-all ${
                  email.length > 0 && !isEmailValid ? 'border-rose-500/60 ring-1 ring-rose-500/30' : ''
                }`}
              />
              {email.length > 0 && (
                <div className="absolute right-3.5 top-3.5">
                  {isEmailValid ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <X className="w-4 h-4 text-rose-400" />
                  )}
                </div>
              )}
            </div>
            {email.length > 0 && !isEmailValid && (
              <p className="text-[11px] text-rose-400 mt-1">Please enter a valid email address</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 font-mono">Password</label>
              <span className={`text-[11px] font-mono ${isPasswordLongEnough ? 'text-emerald-400' : 'text-slate-500'}`}>
                {password.length > 0 ? (isPasswordLongEnough ? '✓ 8+ chars' : `${password.length}/8 min`) : 'Min. 8 characters'}
              </span>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="At least 8 characters"
                className={`w-full pl-10 pr-10 py-2.5 cyber-input text-sm text-slate-100 placeholder-slate-500 transition-all ${
                  password.length > 0 && !isPasswordLongEnough ? 'border-amber-500/60 ring-1 ring-amber-500/30' : ''
                }`}
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

          {/* Confirm Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300 font-mono">Confirm Password</label>
              {confirmPassword.length > 0 && (
                <span className={`text-[11px] font-mono font-medium ${doPasswordsMatch ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {doPasswordsMatch ? '✓ Passwords match' : '✗ Do not match'}
                </span>
              )}
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Re-enter password"
                className={`w-full pl-10 pr-10 py-2.5 cyber-input text-sm text-slate-100 placeholder-slate-500 transition-all ${
                  confirmPassword.length > 0 && !doPasswordsMatch ? 'border-rose-500/60 ring-1 ring-rose-500/30' : ''
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Registration Issue</p>
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || (confirmPassword.length > 0 && !doPasswordsMatch)}
            className="w-full py-3 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Registering Account...</span>
              </>
            ) : (
              <>
                <span>Register Owner Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Instant Sandbox Launch Button */}
          <div className="pt-2 border-t border-cyber-border/60">
            <button
              type="button"
              onClick={handleDemoAccess}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Launch Instant Demo Mode (Vidarbh)
            </button>
          </div>
        </form>
      </div>

      {/* Navigation Footer (Requirement 1: entry-seq-3) */}
      <p className="entry-seq-3 text-center text-xs text-slate-400">
        Already have an account?{' '}
        <Link href="/login" className="text-cyan-400 hover:text-cyan-300 hover:underline font-semibold">
          Sign In
        </Link>
      </p>
    </div>
  );
}
