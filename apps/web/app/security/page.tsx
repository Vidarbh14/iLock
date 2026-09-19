'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Key, Laptop, Lock, RefreshCw, Filter, Fingerprint, Shield, AlertTriangle } from 'lucide-react';
import type { AuditLog } from '@ilock/shared';
import { CornerOrb } from '@/components/CornerOrb';

export default function SecurityAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  const fetchLogs = async () => {
    try {
      setHasError(false);
      const res = await fetch('/api/audit');
      const data = await res.json();
      if (data.logs && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const eventType = String(log.eventType || (log as any).event_type || '');
    if (filter === 'ACCESS') return eventType.startsWith('ACCESS_');
    if (filter === 'DEVICE') return eventType.startsWith('DEVICE_') || eventType.startsWith('PAIRING_');
    if (filter === 'SECURITY') return eventType.includes('REJECTED') || eventType.includes('SECURITY') || !log.success;
    return true;
  });

  const getEventBadge = (eventType: string, success: boolean) => {
    const type = String(eventType || '');
    if (!success) {
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }
    if (type.includes('REVOKED') || type.includes('REMOVED')) {
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }
    if (type.includes('CREATED') || type.includes('REGISTERED')) {
      return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            Security & Audit Telemetry
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tamper-resistant cryptographic audit logs and zero-trust protocol telemetry
          </p>
        </div>

        <button
          onClick={() => {
            setIsRefreshing(true);
            fetchLogs();
          }}
          className="p-2.5 rounded-xl glass-card border border-cyber-border text-slate-400 hover:text-cyan-400 transition-colors"
          title="Refresh Audit Log"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* Security Architecture Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative p-5 rounded-3xl glass-card space-y-2 border border-cyber-border overflow-hidden">
          <CornerOrb variant="cyan" />
          <span className="text-[11px] text-cyan-400 font-semibold flex items-center gap-1.5 uppercase font-mono">
            <Key className="w-3.5 h-3.5" /> Zero Credential Storage
          </span>
          <p className="text-xs text-slate-300 leading-relaxed">
            Windows login credentials are never stored or transmitted. The Windows service unlocks the session locally via DPAPI token elevation.
          </p>
        </div>

        <div className="relative p-5 rounded-3xl glass-card space-y-2 border border-cyber-border overflow-hidden">
          <CornerOrb variant="emerald" />
          <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 uppercase font-mono">
            <ShieldCheck className="w-3.5 h-3.5" /> Asymmetric Enclave
          </span>
          <p className="text-xs text-slate-300 leading-relaxed">
            Every enrolled PC generates and stores an asymmetric private key in Windows DPAPI to authenticate commands and heartbeats.
          </p>
        </div>

        <div className="relative p-5 rounded-3xl glass-card space-y-2 border border-cyber-border overflow-hidden">
          <CornerOrb variant="rose" />
          <span className="text-[11px] text-rose-400 font-semibold flex items-center gap-1.5 uppercase font-mono">
            <Lock className="w-3.5 h-3.5" /> Replay & Drift Shield
          </span>
          <p className="text-xs text-slate-300 leading-relaxed">
            Single-use cryptographic nonces and strict 120s server-time drift checks prevent replay attacks across all endpoints.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl glass-card border border-cyber-border max-w-md">
        {['ALL', 'ACCESS', 'DEVICE', 'SECURITY'].map((f) => (
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

      {/* Log Feed */}
      <div className="p-6 glass-card rounded-3xl border border-cyber-border space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-cyber-border/60">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            Audit Ledger ({filteredLogs.length} Events)
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Immutable Audit Trail
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-slate-950/40 border border-cyber-border/40 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : hasError ? (
          <div className="text-center py-10 space-y-2">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-xs text-slate-300">Unable to load audit ledger at this moment.</p>
            <button
              onClick={fetchLogs}
              className="text-xs text-cyan-400 hover:underline font-mono"
            >
              Try Reconnecting
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-10">No audit records found matching this filter.</p>
        ) : (
          <div className="divide-y divide-cyber-border/60 text-xs">
            {filteredLogs.map((log) => {
              const eventType = String(log.eventType || (log as any).event_type || 'UNKNOWN');
              const ipHash = log.ipHash || (log as any).ip_hash || 'Local Agent (127.0.0.1)';
              const rawTimestamp = log.timestamp || (log as any).created_at;
              const dateObj = rawTimestamp ? new Date(rawTimestamp) : new Date();
              const isValidDate = !isNaN(dateObj.getTime());
              const dateStr = isValidDate ? dateObj.toLocaleDateString() : 'Recent';
              const timeStr = isValidDate ? dateObj.toLocaleTimeString() : '';

              return (
                <div key={log.id} className="py-3.5 flex items-start justify-between gap-4 hover:bg-slate-900/30 px-2 rounded-xl transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`font-mono text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${getEventBadge(
                          eventType,
                          log.success
                        )}`}
                      >
                        {eventType}
                      </span>
                      <span className={`text-[11px] font-mono ${log.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {log.success ? '● Verified' : '✕ Rejected'}
                      </span>
                    </div>
                    <p className="text-slate-200 font-medium">{log.reason || 'Cryptographic transaction recorded'}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      IP Hash: <span className="text-slate-400">{ipHash}</span>
                    </p>
                  </div>

                  <div className="text-right font-mono text-[11px] text-slate-400 flex-shrink-0">
                    <div className="text-slate-300">{dateStr}</div>
                    <div className="text-cyan-400/80">{timeStr}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
