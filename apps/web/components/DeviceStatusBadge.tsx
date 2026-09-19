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
      bg: 'bg-[#30d158]/10 border-[#30d158]/25 backdrop-blur-md',
      text: 'text-[#30d158]',
      dot: 'bg-[#30d158] shadow-[0_0_8px_rgba(48,209,88,0.7)] animate-pulse',
    },
    offline: {
      label: 'Offline',
      bg: 'bg-white/[0.04] border-white/[0.08] backdrop-blur-md',
      text: 'text-[#86868b]',
      dot: 'bg-[#86868b]',
    },
    connecting: {
      label: 'Connecting',
      bg: 'bg-[#ff9f0a]/10 border-[#ff9f0a]/25 backdrop-blur-md',
      text: 'text-[#ff9f0a]',
      dot: 'bg-[#ff9f0a] animate-ping',
    },
    auth_failed: {
      label: 'Auth Failed',
      bg: 'bg-[#ff453a]/10 border-[#ff453a]/25 backdrop-blur-md',
      text: 'text-[#ff6961]',
      dot: 'bg-[#ff453a]',
    },
    outdated: {
      label: 'Agent Outdated',
      bg: 'bg-[#ffd60a]/10 border-[#ffd60a]/25 backdrop-blur-md',
      text: 'text-[#ffd60a]',
      dot: 'bg-[#ffd60a]',
    },
    revoked: {
      label: 'Revoked',
      bg: 'bg-[#ff453a]/10 border-[#ff453a]/25 backdrop-blur-md',
      text: 'text-[#ff6961]',
      dot: 'bg-[#ff453a]',
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
