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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Emergency Revoke Access</h3>
              <p className="text-xs text-slate-400">Immediate Session Termination</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
          <p className="font-semibold text-white">Are you sure you want to revoke this session?</p>
          <ul className="list-disc pl-4 space-y-1 text-slate-400">
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
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors shadow-[0_0_15px_rgba(244,63,94,0.3)] disabled:opacity-50 flex items-center gap-1.5"
          >
            <Lock className="w-4 h-4" />
            {isSubmitting ? 'Revoking...' : 'Revoke & Lock PC'}
          </button>
        </div>
      </div>
    </div>
  );
}
