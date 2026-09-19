'use client';

import React, { useState } from 'react';
import { ShieldAlert, X, AlertTriangle, Lock, Loader2 } from 'lucide-react';
import type { AccessSession } from '@ilock/shared';
import { CornerOrb } from './CornerOrb';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-md glass-modal p-6 shadow-2xl space-y-5 relative overflow-hidden border border-white/[0.1]">
        <CornerOrb position="top-right" variant="rose" size="sm" active />
        <CornerOrb position="bottom-left" variant="amber" size="sm" active />

        {/* Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#f43f5e]/15 border border-[#f43f5e]/30 text-[#fb7185] shadow-[0_0_15px_rgba(244,63,94,0.3)]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#f0f3f6]">Emergency Kill Switch</h3>
              <p className="text-xs text-[#8b949e] font-mono">Immediate Session Termination</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/[0.08] text-[#8b949e] hover:text-[#f0f3f6] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 text-xs bg-[#f43f5e]/15 border border-[#f43f5e]/30 text-[#fb7185] rounded-2xl animate-shake">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-xs text-[#8b949e] space-y-2 relative z-10">
          <p className="text-[#f0f3f6] font-medium leading-relaxed">
            Are you sure you want to revoke this active session immediately?
          </p>
          <div className="pt-2 border-t border-white/[0.06] space-y-1 font-mono text-[11px]">
            <div className="flex justify-between">
              <span>Session ID:</span>
              <span className="text-[#f0f3f6] truncate max-w-[180px]">{session.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Action:</span>
              <span className="text-[#fb7185] font-semibold">Immediate Lock & Invalidate Token</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full text-xs font-medium apple-btn-secondary"
          >
            Keep Active
          </button>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-full text-xs font-semibold text-white apple-btn-danger disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            <span>{isSubmitting ? 'Revoking...' : 'Revoke & Lock Now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
