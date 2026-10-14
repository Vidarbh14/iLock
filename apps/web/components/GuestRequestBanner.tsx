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
          className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-200/80 shadow-md backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-2"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100/90 text-amber-700 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-[#1d1d1f]">Guest Access Requested</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/70 text-amber-800">
                  {req.requestedMinutes} min
                </span>
              </div>
              <p className="text-xs text-[#1d1d1f]/80 mt-0.5">
                <span className="font-semibold text-[#1d1d1f]">{req.guestName}</span> is requesting temporary access
                {req.reason ? `: "${req.reason}"` : '.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              disabled={isProcessing === req.id}
              onClick={() => handleAction(req.id, 'REJECT')}
              className="py-2 px-3.5 rounded-xl border border-black/[0.1] bg-white/60 hover:bg-white text-xs font-semibold text-[#1d1d1f] transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <UserX className="w-3.5 h-3.5 text-red-600" />
              <span>Decline</span>
            </button>

            <button
              disabled={isProcessing === req.id}
              onClick={() => handleAction(req.id, 'APPROVE')}
              className="py-2 px-4 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
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
