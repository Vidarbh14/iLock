'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, ArrowRight, Laptop } from 'lucide-react';
import { AmbientBackground } from '@/components/AmbientBackground';

export default function RequestAccessRootPage() {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState('');

  const handleProceed = (e: React.FormEvent) => {
    e.preventDefault();
    if (deviceId.trim()) {
      router.push(`/request-access/${encodeURIComponent(deviceId.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] relative overflow-hidden flex flex-col justify-center items-center px-4 py-12">
      <AmbientBackground />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white shadow-md border border-black/[0.06] mb-4">
            <KeyRound className="w-7 h-7 text-[#0071e3]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Guest Workstation Access</h1>
          <p className="text-sm text-[#86868b] mt-1">Scan screen QR or enter workstation pairing code</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-xl border border-black/[0.06]">
          <form onSubmit={handleProceed} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wider">
                Workstation Device ID / UUID
              </label>
              <div className="relative">
                <Laptop className="w-4 h-4 text-[#86868b] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="e.g. b0000000-0000-0000-0000-000000000001"
                  className="w-full pl-10 pr-4 py-2.5 bg-black/[0.03] border border-black/[0.08] rounded-xl text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 focus:border-[#0071e3] transition-all font-mono text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-sm rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
