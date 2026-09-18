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
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 mx-auto flex items-center justify-center text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">Create Owner Account</h1>
        <p className="text-xs text-slate-400">
          Enforce zero-knowledge access authorization on your computers
        </p>
      </div>

      {!isConfigured && (
        <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-300 space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Instant Sandbox Mode Active
          </p>
          <p className="text-slate-400 text-[11px]">
            Supabase database is not connected in Vercel. You can sign up with any test credentials to access the full interactive dashboard.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isEmailSent ? (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-xl">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Verification Email Sent</h3>
          <p className="text-xs text-slate-400">
            We sent a confirmation link to <span className="text-slate-200 font-semibold">{email}</span>. Please verify your email to activate your account.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-block px-4 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSignup} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@example.com"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isLoading ? 'Creating...' : 'Register Account'}
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Instant Sandbox Launch Button */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleDemoAccess}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
            >
              <ShieldCheck className="w-4 h-4" />
              Launch Instant Demo Mode (Vidarbh)
            </button>
          </div>
        </form>
      )}

      <p className="text-center text-xs text-slate-400">
        Already have an account?{' '}
        <Link href="/login" className="text-cyan-400 hover:underline font-semibold">
          Sign In
        </Link>
      </p>
    </div>
  );
}

