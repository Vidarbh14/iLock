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
      bg: 'bg-[#34c759]/10 border-[#34c759]/25',
      text: 'text-[#248a3d]',
      dot: 'bg-[#34c759] shadow-[0_0_6px_rgba(52,199,89,0.6)] animate-pulse',
    },
    offline: {
      label: 'Offline',
      bg: 'bg-black/[0.04] border-black/[0.08]',
      text: 'text-[#6e6e73]',
      dot: 'bg-[#86868b]',
    },
    connecting: {
      label: 'Connecting',
      bg: 'bg-[#ff9500]/10 border-[#ff9500]/25',
      text: 'text-[#b26a00]',
      dot: 'bg-[#ff9500] animate-ping',
    },
    auth_failed: {
      label: 'Auth Failed',
      bg: 'bg-[#ff3b30]/10 border-[#ff3b30]/25',
      text: 'text-[#d70015]',
      dot: 'bg-[#ff3b30]',
    },
    outdated: {
      label: 'Agent Outdated',
      bg: 'bg-[#ffcc00]/15 border-[#ffcc00]/30',
      text: 'text-[#8f7200]',
      dot: 'bg-[#ffcc00]',
    },
    revoked: {
      label: 'Revoked',
      bg: 'bg-[#ff3b30]/10 border-[#ff3b30]/25',
      text: 'text-[#d70015]',
      dot: 'bg-[#ff3b30]',
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
