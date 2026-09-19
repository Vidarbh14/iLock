'use client';

import React, { useState } from 'react';
import { ShieldAlert, X, AlertTriangle, Lock } from 'lucide-react';
import type { AccessSession } from '@ilock/shared';

interface Props {
  session: AccessSession | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConfirmRevokeModal({ session, isOpen, onClose, onSuccess }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !session) return null;

  const handleRevoke = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/access/${session.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual remote kill switch triggered by owner' }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to revoke access');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Revocation request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md glass-modal p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#ff3b30]/10 border border-[#ff3b30]/20 text-[#ff3b30] shadow-[0_0_12px_rgba(255,59,48,0.15)]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">Emergency Revoke Access</h3>
              <p className="text-xs text-[#6e6e73]">Immediate Session Termination</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/[0.05] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs bg-[#ff3b30]/10 border border-[#ff3b30]/25 text-[#ff3b30] rounded-2xl backdrop-blur-md">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] text-xs text-[#1d1d1f] space-y-2">
          <p className="font-semibold text-[#1d1d1f]">Are you sure you want to revoke this session?</p>
          <ul className="list-disc pl-4 space-y-1.5 text-[#6e6e73]">
            <li>The remote authorization will be invalidated instantly.</li>
            <li>The Windows workstation will be immediately locked via Win32 LockWorkStation.</li>
            <li>This action is permanent and cannot be undone.</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium apple-btn-secondary rounded-full"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-medium text-white apple-btn-danger rounded-full disabled:opacity-50 flex items-center gap-1.5"
          >
            <Lock className="w-4 h-4" />
            {isSubmitting ? 'Revoking...' : 'Revoke & Lock PC'}
          </button>
        </div>
      </div>
    </div>
  );
}
