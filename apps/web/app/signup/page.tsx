'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Mail, KeyRound, ArrowRight, AlertCircle, Shield, CheckCircle2, ShieldCheck } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase-client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const isConfigured = isSupabaseConfigured();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!isConfigured) {
        // Instant Demo Registration: Seamlessly enter dashboard
        router.push('/dashboard');
        return;
      }

      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (data.user && !data.session) {
        setIsEmailSent(true);
        return;
      }

      router.push('/dashboard');
    } catch (err: any) {
      // If network error due to placeholder URL, fallback gracefully to demo
      if (err.message?.includes('fetch') || err.message?.includes('network')) {
        router.push('/dashboard');
        return;
      }
      setError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoAccess = () => {
    router.push('/dashboard');
  };

  return (
    <div className="max-w-md mx-auto my-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-b from-white/[0.15] to-white/[0.04] border border-white/[0.12] mx-auto flex items-center justify-center text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          <Shield className="w-7 h-7 text-[#2997ff]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Create Owner Account</h1>
        <p className="text-xs text-slate-400">
          Enforce zero-knowledge access authorization on your computers
        </p>
      </div>

      {!isConfigured && (
        <div className="p-3.5 rounded-2xl bg-[#2997ff]/10 border border-[#2997ff]/25 text-xs text-[#2997ff] space-y-1 backdrop-blur-md">
          <p className="font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2997ff] animate-pulse" />
            Instant Sandbox Mode Active
          </p>
          <p className="text-slate-400 text-[11px]">
            Supabase database is not connected in Vercel. You can sign up with any test credentials to access the full interactive dashboard.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff6961] rounded-2xl backdrop-blur-md">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isEmailSent ? (
        <div className="p-7 rounded-3xl glass-card text-center space-y-4 shadow-xl">
          <CheckCircle2 className="w-12 h-12 text-[#30d158] mx-auto" />
          <h3 className="text-base font-semibold text-white">Verification Email Sent</h3>
          <p className="text-xs text-slate-400">
            We sent a confirmation link to <span className="text-slate-200 font-semibold">{email}</span>. Please verify your email to activate your account.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-block px-5 py-2 rounded-full text-xs font-medium text-white apple-btn-primary"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSignup} className="p-7 rounded-3xl glass-card space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 apple-input text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full pl-10 pr-3.5 py-2.5 apple-input text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="w-full pl-10 pr-3.5 py-2.5 apple-input text-sm text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-full text-xs font-semibold text-white apple-btn-primary disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isLoading ? 'Creating...' : 'Register Account'}
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Instant Sandbox Launch Button */}
          <div className="pt-2 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={handleDemoAccess}
              className="w-full py-2.5 rounded-full text-xs font-medium text-[#30d158] bg-[#30d158]/10 hover:bg-[#30d158]/20 border border-[#30d158]/30 transition-colors flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(48,209,88,0.15)]"
            >
              <ShieldCheck className="w-4 h-4" />
              Launch Instant Demo Mode (Vidarbh)
            </button>
          </div>
        </form>
      )}

      <p className="text-center text-xs text-slate-400">
        Already have an account?{' '}
        <Link href="/login" className="text-[#2997ff] hover:underline font-medium">
          Sign In
        </Link>
      </p>
    </div>
  );
}

