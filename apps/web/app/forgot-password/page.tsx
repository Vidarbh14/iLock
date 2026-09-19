'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Lock, Mail, ArrowLeft, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { CornerOrb } from '@/components/CornerOrb';

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
    <div className="max-w-md mx-auto my-12 px-4 space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-3">
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 mx-auto flex items-center justify-center text-cyan-400 shadow-[0_0_25px_rgba(0,229,255,0.25)]">
          <Lock className="w-8 h-8 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Reset Password
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enter your registered operator email to receive recovery instructions
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3.5 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isSubmitted ? (
        <div className="relative p-7 rounded-3xl glass-card text-center space-y-4 border border-cyber-border overflow-hidden">
          <CornerOrb variant="emerald" />
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-100">Recovery Instructions Dispatched</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            If an account exists for <span className="text-cyan-400 font-mono">{email}</span>, you will receive password reset instructions.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 mt-2 text-xs text-cyan-400 hover:text-cyan-300 hover:underline font-semibold"
          >
            &larr; Return to Sign In
          </Link>
        </div>
      ) : (
        <div className="relative p-7 rounded-3xl glass-card space-y-5 border border-cyber-border overflow-hidden">
          <CornerOrb variant="cyan" />
          <form onSubmit={handleReset} className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 font-mono">
                Operator Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@security.local"
                  className="w-full pl-10 pr-3.5 py-2.5 cyber-input text-sm text-slate-100 placeholder-slate-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all disabled:opacity-50"
            >
              {isLoading ? 'Dispatching...' : 'Send Recovery Instructions'}
            </button>
          </form>
        </div>
      )}

      <p className="text-center text-xs text-slate-400">
        <Link href="/login" className="text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </Link>
      </p>
    </div>
  );
}
