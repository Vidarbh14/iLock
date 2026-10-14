'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Laptop,
  Clock,
  Send,
  CheckCircle2,
  AlertTriangle,
  User,
  Shield,
  Sparkles,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import { AmbientBackground } from '@/components/AmbientBackground';

export default function RequestAccessPage({ params }: { params: { id: string } }) {
  const { id: deviceId } = params;
  const [guestName, setGuestName] = useState('');
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationOptions = [
    { label: '15 Min', value: 15 },
    { label: '30 Min', value: 30 },
    { label: '1 Hour', value: 60 },
    { label: '2 Hours', value: 120 },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/access/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          guestName: guestName.trim(),
          requestedMinutes: duration,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to submit request');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] relative overflow-hidden flex flex-col justify-center items-center px-4 py-12">
      <AmbientBackground />

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-md border border-black/[0.06] mb-4">
            <KeyRound className="w-7 h-7 text-[#0071e3]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">iLock Temporary Access</h1>
          <p className="text-sm text-[#86868b] mt-1">Request permission to temporarily unlock this workstation</p>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-xl border border-black/[0.06]">
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100 animate-pulse">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">Request Sent!</h2>
              <p className="text-sm text-[#86868b] mb-6">
                The computer owner has received an instant notification on their phone. Once approved, this PC will unlock automatically.
              </p>
              <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.04] text-xs text-[#86868b] mb-6 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-[#0071e3]" />
                Requested duration: <span className="font-semibold text-[#1d1d1f]">{duration} minutes</span>
              </div>
              <button
                onClick={() => setSubmitted(false)}
                className="text-xs font-semibold text-[#0071e3] hover:underline"
              >
                Submit another request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wider">
                  Your Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. Alex or Mom"
                    className="w-full pl-10 pr-4 py-2.5 bg-black/[0.03] border border-black/[0.08] rounded-xl text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] transition-all"
                  />
                </div>
              </div>

              {/* Duration Options */}
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-2 uppercase tracking-wider">
                  Requested Duration
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {durationOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDuration(opt.value)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                        duration === opt.value
                          ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-sm'
                          : 'bg-black/[0.02] text-[#1d1d1f] border-black/[0.06] hover:bg-black/[0.04]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wider">
                  Reason / Task (Optional)
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Printing a syllabus, checking email..."
                  className="w-full px-3.5 py-2.5 bg-black/[0.03] border border-black/[0.08] rounded-xl text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] transition-all"
                />
              </div>

              {/* Security Banner */}
              <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-start gap-2.5 text-xs text-[#1d1d1f]/80">
                <Shield className="w-4 h-4 text-[#0071e3] shrink-0 mt-0.5" />
                <span>
                  Zero password required. Session will automatically terminate and lock when the duration ends.
                </span>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-sm rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Access Request</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-[#86868b]">
          <Link href="/login" className="hover:text-[#1d1d1f] transition-colors">
            Workstation Owner Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
