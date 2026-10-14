'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  Clipboard,
  Send,
  X,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface QuickMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
  onSuccess?: (msg: string) => void;
}

export function QuickMessageModal({
  isOpen,
  onClose,
  deviceId,
  deviceName,
  onSuccess,
}: QuickMessageModalProps) {
  const [mode, setMode] = useState<'toast' | 'clipboard'>('toast');
  const [toastTitle, setToastTitle] = useState('iLock Alert');
  const [toastMessage, setToastMessage] = useState('');
  const [clipboardText, setClipboardText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === 'toast') {
        if (!toastMessage.trim()) throw new Error('Message cannot be empty');
        const res = await fetch(`/api/devices/${deviceId}/toast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: toastTitle, message: toastMessage.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || 'Failed to dispatch notification');
        onSuccess?.('Notification displayed on workstation screen');
      } else {
        if (!clipboardText.trim()) throw new Error('Clipboard text cannot be empty');
        const res = await fetch(`/api/devices/${deviceId}/clipboard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clipboardText }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || 'Failed to push clipboard text');
        onSuccess?.('Text pushed to workstation clipboard');
      }

      onClose();
      setToastMessage('');
      setClipboardText('');
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-2xl border border-black/[0.08] rounded-3xl shadow-2xl max-w-md w-full p-6 text-[#1d1d1f] relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 text-[#86868b] hover:text-[#1d1d1f] rounded-full hover:bg-black/[0.04] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-black/[0.04] flex items-center justify-center">
            {mode === 'toast' ? (
              <MessageSquare className="w-5 h-5 text-[#0071e3]" />
            ) : (
              <Clipboard className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f]">Remote Companion Utility</h3>
            <p className="text-xs text-[#86868b]">{deviceName}</p>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-2 p-1 bg-black/[0.04] rounded-2xl mb-5">
          <button
            type="button"
            onClick={() => setMode('toast')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
              mode === 'toast' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Screen Popup
          </button>
          <button
            type="button"
            onClick={() => setMode('clipboard')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
              mode === 'clipboard' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            Push Clipboard
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'toast' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1 uppercase tracking-wider">
                  Notification Title
                </label>
                <input
                  type="text"
                  value={toastTitle}
                  onChange={(e) => setToastTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/[0.03] border border-black/[0.08] rounded-xl text-xs text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1d1d1f] mb-1 uppercase tracking-wider">
                  Message Content
                </label>
                <textarea
                  rows={3}
                  required
                  value={toastMessage}
                  onChange={(e) => setToastMessage(e.target.value)}
                  placeholder="e.g. Please save your work, locking in 5 minutes!"
                  className="w-full px-3.5 py-2.5 bg-black/[0.03] border border-black/[0.08] rounded-xl text-xs text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-[#1d1d1f] mb-1 uppercase tracking-wider">
                Text or URL to Paste into PC Clipboard
              </label>
              <textarea
                rows={4}
                required
                value={clipboardText}
                onChange={(e) => setClipboardText(e.target.value)}
                placeholder="Paste links, Wi-Fi codes, or 2FA credentials directly to your computer..."
                className="w-full px-3.5 py-2.5 bg-black/[0.03] border border-black/[0.08] rounded-xl text-xs font-mono text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-black/[0.08] text-xs font-semibold text-[#1d1d1f] hover:bg-black/[0.03] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to Workstation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
