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
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-3xl bg-white border border-black/[0.08] mx-auto flex items-center justify-center text-[#0071e3] shadow-sm">
          <Shield className="w-7 h-7 text-[#0071e3]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Create Owner Account</h1>
        <p className="text-xs text-[#6e6e73]">
          Register your official email to manage, lock, and unlock your Windows PC
        </p>
      </div>

      {/* Sandbox Notice (Only when Supabase keys are completely unconfigured) */}
      {!isConfigured && (
        <div className="p-3.5 rounded-2xl bg-[#0071e3]/10 border border-[#0071e3]/20 text-xs text-[#0071e3] space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0071e3] animate-pulse" />
            Instant Sandbox Mode Active
          </p>
          <p className="text-[#6e6e73] text-[11px]">
            Supabase is in local sandbox mode. You can register with any email to immediately test all features.
          </p>
        </div>
      )}

      {/* Main Registration Card */}
      <div className="p-7 rounded-3xl glass-card space-y-5 shadow-sm border border-black/[0.06]">
        <form onSubmit={handleSignup} className="space-y-4">
          {/* Email Field */}
          <div>
            <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5">Official Email Address</label>
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
                className={`w-full pl-10 pr-10 py-2.5 apple-input text-sm text-[#1d1d1f] transition-all ${
                  email.length > 0 && !isEmailValid ? 'border-[#ff3b30] focus:ring-[#ff3b30]/20' : ''
                }`}
              />
              {email.length > 0 && (
                <div className="absolute right-3.5 top-3.5">
                  {isEmailValid ? (
                    <Check className="w-4 h-4 text-[#34c759]" />
                  ) : (
                    <X className="w-4 h-4 text-[#ff3b30]" />
                  )}
                </div>
              )}
            </div>
            {email.length > 0 && !isEmailValid && (
              <p className="text-[11px] text-[#ff3b30] mt-1">Please enter a complete email address</p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#1d1d1f]">Password</label>
              <span className={`text-[11px] ${isPasswordLongEnough ? 'text-[#34c759]' : 'text-[#86868b]'}`}>
                {password.length > 0 ? (isPasswordLongEnough ? '✓ 8+ characters' : `${password.length}/8 min`) : 'Min. 8 characters'}
              </span>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-[#86868b]" />
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
                className={`w-full pl-10 pr-10 py-2.5 apple-input text-sm text-[#1d1d1f] transition-all ${
                  password.length > 0 && !isPasswordLongEnough ? 'border-[#ff9500] focus:ring-[#ff9500]/20' : ''
                }`}
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

          {/* Confirm Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#1d1d1f]">Confirm Password</label>
              {confirmPassword.length > 0 && (
                <span className={`text-[11px] font-medium ${doPasswordsMatch ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
                  {doPasswordsMatch ? '✓ Passwords match' : '✗ Do not match'}
                </span>
              )}
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-[#86868b]" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Re-enter your password"
                className={`w-full pl-10 pr-10 py-2.5 apple-input text-sm text-[#1d1d1f] transition-all ${
                  confirmPassword.length > 0 && !doPasswordsMatch ? 'border-[#ff3b30] focus:ring-[#ff3b30]/20' : ''
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-3.5 text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Banner - Directly above the submit button so user NEVER misses it */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 text-xs bg-[#ff3b30]/10 border border-[#ff3b30]/25 text-[#ff3b30] rounded-2xl animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Registration Issue</p>
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || (confirmPassword.length > 0 && !doPasswordsMatch)}
            className="w-full py-3 rounded-full text-xs font-semibold text-white apple-btn-primary disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Register Account</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Instant Sandbox Launch Button */}
          <div className="pt-2 border-t border-black/[0.06]">
            <button
              type="button"
              onClick={handleDemoAccess}
              className="w-full py-2.5 rounded-full text-xs font-medium text-[#248a3d] bg-[#34c759]/10 hover:bg-[#34c759]/20 border border-[#34c759]/30 transition-colors flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              Launch Instant Demo Mode (Vidarbh)
            </button>
          </div>
        </form>
      </div>

      {/* Navigation Footer */}
      <p className="text-center text-xs text-[#6e6e73]">
        Already have an account?{' '}
        <Link href="/login" className="text-[#0071e3] hover:underline font-semibold">
          Sign In
        </Link>
      </p>
    </div>
  );
}
