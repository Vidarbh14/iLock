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
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'EXPIRING':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse';
      case 'AUTHORIZED':
        return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      case 'EXPIRED':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'REVOKED':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-cyan-400" />
            Access Sessions & History
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time authorization lifecycle tracking and revocation registry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsRefreshing(true);
              fetchData();
            }}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 max-w-md">
        {['ALL', 'ACTIVE', 'EXPIRED', 'REVOKED'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              filter === f
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-900/50 animate-pulse" />
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-12 rounded-2xl bg-slate-900/30 border border-slate-800/60">
          <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No sessions match your filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            const dev = devices.find((d) => d.id === session.deviceId);
            const isLive = session.status === 'ACTIVE' || session.status === 'EXPIRING';

            return (
              <div
                key={session.id}
                className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">
                        {dev?.deviceName || 'Windows PC'}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${getStatusBadge(
                          session.status
                        )}`}
                      >
                        {session.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {String(session.metadata?.purpose || 'Temporary authorization')} • Duration:{' '}
                      {session.durationMinutes}m
                    </p>
                  </div>

                  {isLive && (
                    <button
                      onClick={() => setSessionToRevoke(session)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
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

                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono border-t border-slate-800/40">
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
