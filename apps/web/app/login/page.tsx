'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Mail, KeyRound, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!isConfigured) {
        router.push('/dashboard');
        return;
      }

      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // If Supabase credentials are placeholder or demo user, allow demo login
        if (email === 'demo@ilock.security') {
          router.push('/dashboard');
          return;
        }
        throw authError;
      }

      router.push('/dashboard');
    } catch (err: any) {
      if (err.message?.includes('fetch') || err.message?.includes('network')) {
        router.push('/dashboard');
        return;
      }
      setError(err.message || 'Login failed. Try Demo Mode below.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    router.push('/dashboard');
  };

  return (
    <div className="max-w-md mx-auto my-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-b from-white/[0.15] to-white/[0.04] border border-white/[0.12] mx-auto flex items-center justify-center text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          <Lock className="w-7 h-7 text-[#2997ff]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Sign In to iLock</h1>
        <p className="text-xs text-slate-400">
          Zero-knowledge remote temporary access & PC authorization
        </p>
      </div>

      {!isConfigured && (
        <div className="p-3.5 rounded-2xl bg-[#2997ff]/10 border border-[#2997ff]/25 text-xs text-[#2997ff] space-y-1 backdrop-blur-md">
          <p className="font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2997ff] animate-pulse" />
            Instant Sandbox Mode Active
          </p>
          <p className="text-slate-400 text-[11px]">
            Supabase database is not connected in Vercel. You can click &quot;Launch Instant Demo Mode&quot; below or enter any credentials to proceed.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff6961] rounded-2xl backdrop-blur-md">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="p-7 rounded-3xl glass-card space-y-4">
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
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-slate-300">Password</label>
            <Link href="/forgot-password" className="text-[11px] text-[#2997ff] hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-10 pr-3.5 py-2.5 apple-input text-sm text-white"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-full text-xs font-semibold text-white apple-btn-primary disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Quick Demo Mode Login */}
        <div className="pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={handleDemoLogin}
            className="w-full py-2.5 rounded-full text-xs font-medium text-[#30d158] bg-[#30d158]/10 hover:bg-[#30d158]/20 border border-[#30d158]/30 transition-colors flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(48,209,88,0.15)]"
          >
            <ShieldCheck className="w-4 h-4" />
            Launch Instant Demo Mode (Vidarbh)
          </button>
        </div>
      </form>

      <p className="text-center text-xs text-slate-400">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-[#2997ff] hover:underline font-medium">
          Create Account
        </Link>
      </p>
    </div>
  );
}
