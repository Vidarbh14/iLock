'use client';

import React, { useEffect, useState } from 'react';
import { History, Lock, Shield, RefreshCw, Clock, Radio, AlertCircle } from 'lucide-react';
import type { AccessSession, Device } from '@ilock/shared';
import { SessionCountdown } from '@/components/SessionCountdown';
import { ConfirmRevokeModal } from '@/components/ConfirmRevokeModal';
import { CornerOrb } from '@/components/CornerOrb';

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
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'EXPIRING':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse';
      case 'AUTHORIZED':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'EXPIRED':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'REVOKED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <History className="w-6 h-6 text-cyan-400" />
            Authorization Registry & Sessions
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time policy lifecycle tracking, deterministic expiration, and emergency kill-switch registry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsRefreshing(true);
              fetchData();
            }}
            className="p-2.5 rounded-xl glass-card border border-cyber-border text-slate-400 hover:text-cyan-400 transition-colors"
            title="Refresh Sessions"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl glass-card border border-cyber-border max-w-md">
        {['ALL', 'ACTIVE', 'EXPIRED', 'REVOKED'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
              filter === f
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold shadow-[0_0_12px_rgba(0,229,255,0.3)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl glass-card border border-cyber-border animate-pulse" />
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-16 rounded-3xl glass-card border border-cyber-border space-y-2">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">No authorization sessions found</p>
          <p className="text-xs text-slate-400">There are no sessions matching the &quot;{filter}&quot; filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => {
            const dev = devices.find((d) => d.id === session.deviceId);
            const isLive = session.status === 'ACTIVE' || session.status === 'EXPIRING';

            return (
              <div
                key={session.id}
                className="relative p-5 md:p-6 rounded-3xl glass-card space-y-4 border border-cyber-border overflow-hidden"
              >
                {isLive && (
                  <CornerOrb
                    variant={session.status === 'EXPIRING' ? 'amber' : 'emerald'}
                    pulse={true}
                  />
                )}

                <div className="flex items-start justify-between gap-4 relative z-10">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-bold text-slate-100">
                        {dev?.deviceName || (dev as any)?.device_name || 'Windows Workstation'}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                          session.status
                        )}`}
                      >
                        {session.status}
                      </span>
                      <span className="text-xs font-mono text-cyan-400">
                        {Number(session.durationMinutes ?? (session as any).duration_minutes ?? 15)}m Window
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {String(session.metadata?.purpose || 'Temporary remote authorization')}
                    </p>
                  </div>

                  {isLive && (
                    <button
                      onClick={() => setSessionToRevoke(session)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center gap-1.5 shadow-[0_0_10px_rgba(244,63,94,0.15)]"
                    >
                      <Lock className="w-3.5 h-3.5 text-rose-400" />
                      Revoke
                    </button>
                  )}
                </div>

                {isLive && (
                  <div className="relative z-10">
                    <SessionCountdown
                      expiresAt={session.expiresAt || (session as any).expires_at}
                      totalDurationMinutes={session.durationMinutes || (session as any).duration_minutes || 15}
                      onExpire={fetchData}
                    />
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-cyber-border/60 relative z-10">
                  <span>Issued: {new Date(session.createdAt || (session as any).created_at || Date.now()).toLocaleTimeString()}</span>
                  <span>
                    Deterministic Expiry:{' '}
                    <span className="text-slate-200">
                      {new Date(session.expiresAt || (session as any).expires_at || Date.now()).toLocaleTimeString()}
                    </span>
                  </span>
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
