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
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 mx-auto flex items-center justify-center text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">Sign In to iLock</h1>
        <p className="text-xs text-slate-400">
          Zero-knowledge remote temporary access & PC authorization
        </p>
      </div>

      {!isConfigured && (
        <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-300 space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Instant Sandbox Mode Active
          </p>
          <p className="text-slate-400 text-[11px]">
            Supabase database is not connected in Vercel. You can click &quot;Launch Instant Demo Mode&quot; below or enter any credentials to proceed.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
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
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-slate-300">Password</label>
            <Link href="/forgot-password" className="text-[11px] text-cyan-400 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Quick Demo Mode Login */}
        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleDemoLogin}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
          >
            <ShieldCheck className="w-4 h-4" />
            Launch Instant Demo Mode (Vidarbh)
          </button>
        </div>
      </form>

      <p className="text-center text-xs text-slate-400">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-cyan-400 hover:underline font-semibold">
          Create Account
        </Link>
      </p>
    </div>
  );
}
