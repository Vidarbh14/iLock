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
        <div className="w-14 h-14 rounded-3xl bg-white border border-black/[0.08] mx-auto flex items-center justify-center text-[#0071e3] shadow-sm">
          <Lock className="w-7 h-7 text-[#0071e3]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Reset Password</h1>
        <p className="text-xs text-[#6e6e73]">
          Enter your registered email to receive recovery instructions
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-xs bg-[#ff3b30]/10 border border-[#ff3b30]/25 text-[#ff3b30] rounded-2xl backdrop-blur-md">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isSubmitted ? (
        <div className="p-7 rounded-3xl glass-card text-center space-y-3 shadow-sm">
          <CheckCircle2 className="w-10 h-10 text-[#34c759] mx-auto" />
          <h3 className="text-sm font-semibold text-[#1d1d1f]">Recovery Email Dispatched</h3>
          <p className="text-xs text-[#6e6e73]">
            If an account exists for <span className="text-[#1d1d1f] font-semibold">{email}</span>, you will receive password reset instructions.
          </p>
          <Link
            href="/login"
            className="inline-block mt-2 text-xs text-[#0071e3] hover:underline font-medium"
          >
            &larr; Return to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleReset} className="p-7 rounded-3xl glass-card space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1">Email Address</label>
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-full text-xs font-semibold text-white apple-btn-primary disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send Recovery Instructions'}
          </button>
        </form>
      )}

      <p className="text-center text-xs text-[#6e6e73]">
        <Link href="/login" className="text-[#6e6e73] hover:text-[#1d1d1f] flex items-center justify-center gap-1 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </Link>
      </p>
    </div>
  );
}
