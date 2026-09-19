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
        <div className="w-14 h-14 rounded-3xl bg-white border border-black/[0.08] mx-auto flex items-center justify-center text-[#0071e3] shadow-sm">
          <Lock className="w-7 h-7 text-[#0071e3]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Sign In to iLock</h1>
        <p className="text-xs text-[#6e6e73]">
          Zero-knowledge remote temporary access & PC authorization
        </p>
      </div>

      {!isConfigured && (
        <div className="p-3.5 rounded-2xl bg-[#0071e3]/10 border border-[#0071e3]/20 text-xs text-[#0071e3] space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0071e3] animate-pulse" />
            Instant Sandbox Mode Active
          </p>
          <p className="text-[#6e6e73] text-[11px]">
            Supabase database is not connected in Vercel. You can click &quot;Launch Instant Demo Mode&quot; below or enter any credentials to proceed.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-[#ff3b30]/10 border border-[#ff3b30]/25 text-[#ff3b30] rounded-2xl backdrop-blur-md">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="p-7 rounded-3xl glass-card space-y-4">
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
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-[#1d1d1f]">Password</label>
            <Link href="/forgot-password" className="text-[11px] text-[#0071e3] hover:underline font-medium">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-[#86868b]" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-10 pr-3.5 py-2.5 apple-input text-sm text-[#1d1d1f]"
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

      <p className="text-center text-xs text-[#6e6e73]">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-[#0071e3] hover:underline font-medium">
          Create Account
        </Link>
      </p>
    </div>
  );
}
