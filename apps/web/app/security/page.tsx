'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Key, Laptop, Lock, RefreshCw, Filter, Fingerprint, Shield } from 'lucide-react';
import type { AuditLog } from '@ilock/shared';
import { CornerOrb } from '@/components/CornerOrb';

export default function SecurityAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/audit');
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'ACCESS') return log.eventType.startsWith('ACCESS_');
    if (filter === 'DEVICE') return log.eventType.startsWith('DEVICE_') || log.eventType.startsWith('PAIRING_');
    if (filter === 'SECURITY') return log.eventType.includes('REJECTED') || log.eventType.includes('SECURITY') || !log.success;
    return true;
  });

  const getEventBadge = (eventType: string, success: boolean) => {
    if (!success) {
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }
    if (eventType.includes('REVOKED') || eventType.includes('REMOVED')) {
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }
    if (eventType.includes('CREATED') || eventType.includes('REGISTERED')) {
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
        ) : filteredLogs.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-10">No audit records found.</p>
        ) : (
          <div className="divide-y divide-cyber-border/60 text-xs">
            {filteredLogs.map((log) => (
              <div key={log.id} className="py-3.5 flex items-start justify-between gap-4 hover:bg-slate-900/30 px-2 rounded-xl transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`font-mono text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${getEventBadge(
                        log.eventType,
                        log.success
                      )}`}
                    >
                      {log.eventType}
                    </span>
                    <span className={`text-[11px] font-mono ${log.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {log.success ? '● Verified' : '✕ Rejected'}
                    </span>
                  </div>
                  <p className="text-slate-200 font-medium">{log.reason}</p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    IP Hash: <span className="text-slate-400">{log.ipHash || 'Local Agent (127.0.0.1)'}</span>
                  </p>
                </div>

                <div className="text-right font-mono text-[11px] text-slate-400 flex-shrink-0">
                  <div className="text-slate-300">{new Date(log.timestamp).toLocaleDateString()}</div>
                  <div className="text-cyan-400/80">{new Date(log.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
