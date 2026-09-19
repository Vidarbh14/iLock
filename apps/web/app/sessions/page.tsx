'use client';

import React, { useEffect, useState } from 'react';
import { History, Lock, Shield, RefreshCw, Clock } from 'lucide-react';
import type { AccessSession, Device } from '@ilock/shared';
import { SessionCountdown } from '@/components/SessionCountdown';
import { ConfirmRevokeModal } from '@/components/ConfirmRevokeModal';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<AccessSession[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<AccessSession | null>(null);

  const fetchData = async () => {
    try {
      const [sessRes, devRes] = await Promise.all([
        fetch('/api/access/active'),
        fetch('/api/devices'),
      ]);

      const [sessData, devData] = await Promise.all([sessRes.json(), devRes.json()]);

      if (sessData.activeSessions) setSessions(sessData.activeSessions);
      if (devData.devices) setDevices(devData.devices);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const filteredSessions = sessions.filter((s) => {
    if (filter === 'ACTIVE') return s.status === 'ACTIVE' || s.status === 'EXPIRING';
    if (filter === 'EXPIRED') return s.status === 'EXPIRED';
    if (filter === 'REVOKED') return s.status === 'REVOKED';
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-[#34c759]/15 text-[#248a3d] border-[#34c759]/30';
      case 'EXPIRING':
        return 'bg-[#ff9500]/15 text-[#c97500] border-[#ff9500]/30 animate-pulse';
      case 'AUTHORIZED':
        return 'bg-[#0071e3]/15 text-[#0071e3] border-[#0071e3]/30';
      case 'EXPIRED':
        return 'bg-black/[0.05] text-[#6e6e73] border-black/[0.08]';
      case 'REVOKED':
        return 'bg-[#ff3b30]/15 text-[#ff3b30] border-[#ff3b30]/30';
      default:
        return 'bg-black/[0.05] text-[#6e6e73] border-black/[0.08]';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] flex items-center gap-2">
            <History className="w-6 h-6 text-[#0071e3]" />
            Access Sessions & History
          </h1>
          <p className="text-xs text-[#6e6e73] mt-0.5">
            Real-time authorization lifecycle tracking and revocation registry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsRefreshing(true);
              fetchData();
            }}
            className="p-2 rounded-full apple-btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-full bg-black/[0.04] border border-black/[0.08] max-w-md">
        {['ALL', 'ACTIVE', 'EXPIRED', 'REVOKED'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold transition-all ${
              filter === f
                ? 'bg-[#0071e3] text-white shadow-[0_2px_8px_rgba(0,113,227,0.3)]'
                : 'text-[#6e6e73] hover:text-[#1d1d1f]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl glass-card animate-pulse" />
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-12 rounded-3xl glass-card">
          <Clock className="w-10 h-10 text-[#86868b] mx-auto mb-2" />
          <p className="text-xs text-[#6e6e73]">No sessions match your filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            const dev = devices.find((d) => d.id === session.deviceId);
            const isLive = session.status === 'ACTIVE' || session.status === 'EXPIRING';

            return (
              <div
                key={session.id}
                className="p-4 rounded-2xl glass-card space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#1d1d1f]">
                        {dev?.deviceName || 'Windows PC'}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                          session.status
                        )}`}
                      >
                        {session.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#6e6e73] mt-0.5">
                      {String(session.metadata?.purpose || 'Temporary authorization')} • Duration:{' '}
                      {session.durationMinutes}m
                    </p>
                  </div>

                  {isLive && (
                    <button
                      onClick={() => setSessionToRevoke(session)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-medium apple-btn-danger flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5 text-[#ff3b30]" />
                      Revoke
                    </button>
                  )}
                </div>

                {isLive && (
                  <SessionCountdown
                    expiresAt={session.expiresAt}
                    totalDurationMinutes={session.durationMinutes}
                    onExpire={fetchData}
                  />
                )}

                <div className="pt-1 flex items-center justify-between text-[11px] text-[#86868b] font-mono border-t border-black/[0.06]">
                  <span>Created: {new Date(session.createdAt).toLocaleTimeString()}</span>
                  <span>Expires: {new Date(session.expiresAt).toLocaleTimeString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmRevokeModal
        session={sessionToRevoke}
        isOpen={!!sessionToRevoke}
        onClose={() => setSessionToRevoke(null)}
        onSuccess={fetchData}
      />
    </div>
  );
}
