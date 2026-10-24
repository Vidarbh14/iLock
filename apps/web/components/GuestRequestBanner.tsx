'use client';

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  UserX,
  Clock,
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Fingerprint,
} from 'lucide-react';
import type { GuestAccessRequest } from '@ilock/shared';
import { useAudioNotification } from './AudioNotificationProvider';

interface GuestRequestBannerProps {
  deviceId?: string;
  onSessionCreated?: () => void;
}

export function GuestRequestBanner({ deviceId, onSessionCreated }: GuestRequestBannerProps) {
  const [requests, setRequests] = useState<GuestAccessRequest[]>([]);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const { showNotification } = useAudioNotification();

  const fetchRequests = async () => {
    try {
      const url = deviceId ? `/api/access/requests?deviceId=${deviceId}` : '/api/access/requests';
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data?.requests)) {
        const pending = data.requests.filter((r: GuestAccessRequest) => r.status === 'PENDING');
        setRequests(pending);
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, [deviceId]);

  const handleAction = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setIsProcessing(requestId);
    try {
      const res = await fetch(`/api/access/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (action === 'APPROVE') {
        showNotification(
          'Guest Access Approved',
          `Workstation unlocked for ${data?.request?.guestName ?? 'guest'}`,
          'success'
        );
        onSessionCreated?.();
      } else {
        showNotification(
          'Request Declined',
          `Access request from ${data?.request?.guestName ?? 'guest'} was declined`,
          'warning'
        );
      }

      fetchRequests();
    } catch (err) {
      // Ignored
    } finally {
      setIsProcessing(null);
    }
  };

  if (requests.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {requests.map((req) => (
        <div
          key={req.id}
          className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-lg backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-white">Guest Access Requested</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  {req.requestedMinutes} min
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                <span className="font-semibold text-white">{req.guestName}</span> is requesting temporary access
                {req.reason ? `: "${req.reason}"` : '.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              disabled={isProcessing === req.id}
              onClick={() => handleAction(req.id, 'REJECT')}
              className="py-2 px-3.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <UserX className="w-3.5 h-3.5 text-rose-400" />
              <span>Decline</span>
            </button>

            <button
              disabled={isProcessing === req.id}
              onClick={() => handleAction(req.id, 'APPROVE')}
              className="py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <Fingerprint className="w-3.5 h-3.5" />
              <span>{isProcessing === req.id ? 'Approving...' : 'Approve & Unlock'}</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
