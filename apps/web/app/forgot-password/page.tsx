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
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 mx-auto flex items-center justify-center text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-extrabold text-white">Reset Password</h1>
        <p className="text-xs text-slate-400">
          Enter your registered email to receive recovery instructions
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isSubmitted ? (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-sm font-bold text-white">Recovery Email Dispatched</h3>
          <p className="text-xs text-slate-400">
            If an account exists for <span className="text-slate-200">{email}</span>, you will receive password reset instructions.
          </p>
          <Link
            href="/login"
            className="inline-block mt-2 text-xs text-cyan-400 hover:underline font-semibold"
          >
            &larr; Return to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleReset} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send Recovery Instructions'}
          </button>
        </form>
      )}

      <p className="text-center text-xs text-slate-400">
        <Link href="/login" className="text-slate-400 hover:text-white flex items-center justify-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </Link>
      </p>
    </div>
  );
}
