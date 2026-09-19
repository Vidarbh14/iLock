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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md glass-modal p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#ff453a]/15 border border-[#ff453a]/25 text-[#ff6961] shadow-[0_0_12px_rgba(255,69,58,0.2)]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Emergency Revoke Access</h3>
              <p className="text-xs text-slate-400">Immediate Session Termination</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff6961] rounded-2xl backdrop-blur-md">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-xs text-slate-300 space-y-2">
          <p className="font-semibold text-white">Are you sure you want to revoke this session?</p>
          <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
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
