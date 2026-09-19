'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Key, Laptop, Lock, RefreshCw, Filter } from 'lucide-react';
import type { AuditLog } from '@ilock/shared';

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
      return 'bg-[#ff3b30]/15 text-[#ff3b30] border-[#ff3b30]/30';
    }
    if (eventType.includes('REVOKED') || eventType.includes('REMOVED')) {
      return 'bg-[#ff9500]/15 text-[#c97500] border-[#ff9500]/30';
    }
    if (eventType.includes('CREATED') || eventType.includes('REGISTERED')) {
      return 'bg-[#0071e3]/15 text-[#0071e3] border-[#0071e3]/30';
    }
    return 'bg-black/[0.05] text-[#1d1d1f] border-black/[0.08]';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f] flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#0071e3]" />
            Security & Audit Trail
          </h1>
          <p className="text-xs text-[#6e6e73] mt-0.5">
            Cryptographically verifiably logged events with privacy-preserving telemetry
          </p>
        </div>

        <button
          onClick={() => {
            setIsRefreshing(true);
            fetchLogs();
          }}
          className="p-2 rounded-full apple-btn-secondary"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Security Architecture Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl glass-card space-y-1">
          <span className="text-[11px] text-[#6e6e73] flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-[#0071e3]" /> Zero Credential Storage
          </span>
          <p className="text-xs text-[#1d1d1f] leading-snug">
            Actual Windows passwords are never transmitted or stored in the database.
          </p>
        </div>

        <div className="p-4 rounded-2xl glass-card space-y-1">
          <span className="text-[11px] text-[#6e6e73] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#34c759]" /> Asymmetric Enrollment
          </span>
          <p className="text-xs text-[#1d1d1f] leading-snug">
            Every PC signs heartbeats and commands with a local RSA private key.
          </p>
        </div>

        <div className="p-4 rounded-2xl glass-card space-y-1">
          <span className="text-[11px] text-[#6e6e73] flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#ff3b30]" /> Replay & Drift Shield
          </span>
          <p className="text-xs text-[#1d1d1f] leading-snug">
            Single-use cryptographic nonces and strict 120s server-time drift checks.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-full bg-black/[0.04] border border-black/[0.08] max-w-sm">
        {['ALL', 'ACCESS', 'DEVICE', 'SECURITY'].map((f) => (
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

      {/* Log Feed */}
      <div className="p-5 glass-card">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-black/[0.03] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <p className="text-xs text-[#6e6e73] text-center py-6">No audit records found.</p>
        ) : (
          <div className="divide-y divide-black/[0.06] text-xs">
            {filteredLogs.map((log) => (
              <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${getEventBadge(
                        log.eventType,
                        log.success
                      )}`}
                    >
                      {log.eventType}
                    </span>
                    <span className="text-[#6e6e73] text-[11px]">
                      {log.success ? 'Success' : 'Failure'}
                    </span>
                  </div>
                  <p className="text-[#1d1d1f] font-medium">{log.reason}</p>
                  <p className="text-[11px] text-[#86868b] font-mono">
                    IP Hash: {log.ipHash || 'Internal'}
                  </p>
                </div>

                <div className="text-right font-mono text-[11px] text-[#86868b] flex-shrink-0">
                  <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                  <div>{new Date(log.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
