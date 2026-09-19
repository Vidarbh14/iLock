'use client';

import React from 'react';
import type { DeviceStatus } from '@ilock/shared';

interface Props {
  status: DeviceStatus;
  className?: string;
  showPing?: boolean;
}

export function DeviceStatusBadge({ status, className = '', showPing = true }: Props) {
  const configs: Record<DeviceStatus, { label: string; bg: string; text: string; dot: string; glow: string }> = {
    online: {
      label: 'ONLINE',
      bg: 'bg-[#10b981]/10 border-[#10b981]/30',
      text: 'text-[#10b981]',
      dot: 'bg-[#10b981]',
      glow: 'shadow-[0_0_10px_#10b981]',
    },
    offline: {
      label: 'OFFLINE',
      bg: 'bg-white/[0.04] border-white/[0.08]',
      text: 'text-[#8b949e]',
      dot: 'bg-[#6b7280]',
      glow: '',
    },
    connecting: {
      label: 'CONNECTING',
      bg: 'bg-[#f59e0b]/10 border-[#f59e0b]/30',
      text: 'text-[#f59e0b]',
      dot: 'bg-[#f59e0b]',
      glow: 'shadow-[0_0_10px_#f59e0b]',
    },
    auth_failed: {
      label: 'AUTH FAILED',
      bg: 'bg-[#f43f5e]/10 border-[#f43f5e]/30',
      text: 'text-[#fb7185]',
      dot: 'bg-[#f43f5e]',
      glow: 'shadow-[0_0_10px_#f43f5e]',
    },
    outdated: {
      label: 'AGENT OUTDATED',
      bg: 'bg-[#eab308]/15 border-[#eab308]/30',
      text: 'text-[#fde047]',
      dot: 'bg-[#eab308]',
      glow: '',
    },
    revoked: {
      label: 'REVOKED',
      bg: 'bg-[#f43f5e]/10 border-[#f43f5e]/30',
      text: 'text-[#fb7185]',
      dot: 'bg-[#f43f5e]',
      glow: '',
    },
  };

  const current = configs[status] || configs.offline;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider border backdrop-blur-md ${current.bg} ${current.text} ${className}`}
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        {showPing && status === 'online' && (
          <span className="animate-breathing-ring absolute inline-flex h-3.5 w-3.5 rounded-full bg-[#10b981]" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${current.dot} ${current.glow}`} />
      </span>
      {current.label}
    </span>
  );
}
