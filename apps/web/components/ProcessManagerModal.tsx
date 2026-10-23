'use client';

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  RefreshCw,
  X,
  Search,
  AlertTriangle,
  HardDrive,
  Trash2,
  CheckCircle2,
  Shield,
  Activity,
} from 'lucide-react';

interface ProcessItem {
  Pid: number;
  Name: string;
  Title?: string;
  MemoryMb: number;
  CanKill: boolean;
}

interface ProcessManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
}

export function ProcessManagerModal({
  isOpen,
  onClose,
  deviceId,
  deviceName,
}: ProcessManagerModalProps) {
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isKilling, setIsKilling] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchProcesses = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}/processes`);
      const data = await res.json();
      if (res.ok && data.processes) {
        setProcesses(data.processes);
        setUpdatedAt(data.updatedAt || new Date().toISOString());
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to fetch process list' });
    } finally {
      setIsLoading(false);
    }
  };

  const requestFreshProcessList = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      await fetch(`/api/devices/${deviceId}/processes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
      });
      // Poll after 1.2s and 2.5s for agent response
      setTimeout(fetchProcesses, 1200);
      setTimeout(fetchProcesses, 2500);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to dispatch refresh command' });
      setIsLoading(false);
    }
  };

  const handleKill = async (pid: number, name: string) => {
    if (!window.confirm(`Terminate process "${name}" (PID: ${pid})?`)) return;

    setIsKilling(pid);
    setMessage(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/processes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kill', pid }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: `Termination dispatched for ${name} (PID: ${pid})` });
        // Optimistically remove
        setProcesses((prev) => prev.filter((p) => p.Pid !== pid));
        setTimeout(fetchProcesses, 2000);
      } else {
        setMessage({ type: 'error', text: data.error?.message || 'Failed to terminate process' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to terminate process' });
    } finally {
      setIsKilling(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProcesses();
      requestFreshProcessList();
    }
  }, [isOpen, deviceId]);

  if (!isOpen) return null;

  const filtered = processes.filter(
    (p) =>
      p.Name.toLowerCase().includes(search.toLowerCase()) ||
      (p.Title && p.Title.toLowerCase().includes(search.toLowerCase())) ||
      String(p.Pid).includes(search)
  );

  const totalRamMb = processes.reduce((acc, p) => acc + (p.MemoryMb || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-cyber-card border border-cyber-border rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyber-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Task & Process Manager
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Live HUD
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {deviceName} • {processes.length} Active Tasks • ~{(totalRamMb / 1024).toFixed(1)} GB Monitored RAM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Search & Actions Bar */}
        <div className="flex items-center gap-3 my-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by name, window title, or PID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-cyber-border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
          <button
            onClick={requestFreshProcessList}
            disabled={isLoading}
            className="px-3.5 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Process List Table */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs font-mono">
              No matching processes found.
            </div>
          ) : (
            filtered.map((proc) => (
              <div
                key={proc.Pid}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                    <Activity className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">{proc.Name}</span>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">
                        PID {proc.Pid}
                      </span>
                    </div>
                    {proc.Title && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{proc.Title}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <div className="text-right">
                    <span className="text-xs font-mono font-semibold text-slate-200">
                      {proc.MemoryMb} MB
                    </span>
                    <p className="text-[10px] text-slate-500 font-mono">RAM</p>
                  </div>

                  {proc.CanKill ? (
                    <button
                      onClick={() => handleKill(proc.Pid, proc.Name)}
                      disabled={isKilling === proc.Pid}
                      className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 transition-colors disabled:opacity-40"
                      title="Kill Process"
                    >
                      {isKilling === proc.Pid ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  ) : (
                    <div
                      className="p-2 rounded-lg bg-slate-800/40 text-slate-600"
                      title="Protected System Process"
                    >
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-cyber-border flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Protected core system processes cannot be terminated remotely.</span>
          {updatedAt && (
            <span>Updated {new Date(updatedAt).toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
