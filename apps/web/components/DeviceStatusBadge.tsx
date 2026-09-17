import React from 'react';
import type { DeviceStatus } from '@ilock/shared';

interface Props {
  status: DeviceStatus;
  className?: string;
}

export function DeviceStatusBadge({ status, className = '' }: Props) {
  const configs: Record<DeviceStatus, { label: string; bg: string; text: string; dot: string }> = {
    online: {
      label: 'Online',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      text: 'text-emerald-400',
      dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse',
    },
    offline: {
      label: 'Offline',
      bg: 'bg-slate-500/10 border-slate-500/30',
      text: 'text-slate-400',
      dot: 'bg-slate-400',
    },
    connecting: {
      label: 'Connecting',
      bg: 'bg-amber-500/10 border-amber-500/30',
      text: 'text-amber-400',
      dot: 'bg-amber-400 animate-ping',
    },
    auth_failed: {
      label: 'Auth Failed',
      bg: 'bg-rose-500/10 border-rose-500/30',
      text: 'text-rose-400',
      dot: 'bg-rose-400',
    },
    outdated: {
      label: 'Agent Outdated',
      bg: 'bg-yellow-500/10 border-yellow-500/30',
      text: 'text-yellow-400',
      dot: 'bg-yellow-400',
    },
    revoked: {
      label: 'Revoked',
      bg: 'bg-red-500/10 border-red-500/30',
      text: 'text-red-400',
      dot: 'bg-red-400',
    },
  };

  const current = configs[status] || configs.offline;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${current.bg} ${current.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      {current.label}
    </span>
  );
}
