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
        <div className="w-14 h-14 rounded-3xl bg-white border border-black/[0.08] mx-auto flex items-center justify-center text-[#0071e3] shadow-sm">
          <Shield className="w-7 h-7 text-[#0071e3]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Create Owner Account</h1>
        <p className="text-xs text-[#6e6e73]">
          Enforce zero-knowledge access authorization on your computers
        </p>
      </div>

      {!isConfigured && (
        <div className="p-3.5 rounded-2xl bg-[#0071e3]/10 border border-[#0071e3]/20 text-xs text-[#0071e3] space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0071e3] animate-pulse" />
            Instant Sandbox Mode Active
          </p>
          <p className="text-[#6e6e73] text-[11px]">
            Supabase database is not connected in Vercel. You can sign up with any test credentials to access the full interactive dashboard.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-[#ff3b30]/10 border border-[#ff3b30]/25 text-[#ff3b30] rounded-2xl backdrop-blur-md">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isEmailSent ? (
        <div className="p-7 rounded-3xl glass-card text-center space-y-4 shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-[#34c759] mx-auto" />
          <h3 className="text-base font-semibold text-[#1d1d1f]">Verification Email Sent</h3>
          <p className="text-xs text-[#6e6e73]">
            We sent a confirmation link to <span className="text-[#1d1d1f] font-semibold">{email}</span>. Please verify your email to activate your account.
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
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[#86868b]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 apple-input text-sm text-[#1d1d1f]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1">Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-[#86868b]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full pl-10 pr-3.5 py-2.5 apple-input text-sm text-[#1d1d1f]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1">Confirm Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-[#86868b]" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="w-full pl-10 pr-3.5 py-2.5 apple-input text-sm text-[#1d1d1f]"
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
      )}

      <p className="text-center text-xs text-[#6e6e73]">
        Already have an account?{' '}
        <Link href="/login" className="text-[#0071e3] hover:underline font-medium">
          Sign In
        </Link>
      </p>
    </div>
  );
}

