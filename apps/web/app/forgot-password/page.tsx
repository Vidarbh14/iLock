'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Lock, Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (resetError) throw resetError;
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send recovery email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-b from-white/[0.15] to-white/[0.04] border border-white/[0.12] mx-auto flex items-center justify-center text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          <Lock className="w-7 h-7 text-[#2997ff]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Reset Password</h1>
        <p className="text-xs text-slate-400">
          Enter your registered email to receive recovery instructions
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff6961] rounded-2xl backdrop-blur-md">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isSubmitted ? (
        <div className="p-7 rounded-3xl glass-card text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-[#30d158] mx-auto" />
          <h3 className="text-sm font-semibold text-white">Recovery Email Dispatched</h3>
          <p className="text-xs text-slate-400">
            If an account exists for <span className="text-slate-200">{email}</span>, you will receive password reset instructions.
          </p>
          <Link
            href="/login"
            className="inline-block mt-2 text-xs text-[#2997ff] hover:underline font-medium"
          >
            &larr; Return to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleReset} className="p-7 rounded-3xl glass-card space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-full text-xs font-semibold text-white apple-btn-primary disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send Recovery Instructions'}
          </button>
        </form>
      )}

      <p className="text-center text-xs text-slate-400">
        <Link href="/login" className="text-slate-400 hover:text-white flex items-center justify-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </Link>
      </p>
    </div>
  );
}
