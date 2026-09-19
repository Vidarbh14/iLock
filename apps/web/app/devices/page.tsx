'use client';

import React, { useEffect, useState } from 'react';
import { Laptop, Plus, RefreshCw, Search, Shield, Cpu, Zap } from 'lucide-react';
import type { Device } from '@ilock/shared';
import { DeviceCard } from '@/components/DeviceCard';
import { GrantAccessModal } from '@/components/GrantAccessModal';
import { PairDeviceModal } from '@/components/PairDeviceModal';
import { BiometricUnlockModal } from '@/components/BiometricUnlockModal';
import { CornerOrb } from '@/components/CornerOrb';

type DeviceWithStatus = Device & { device_status?: any[] };

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceWithStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDeviceForGrant, setSelectedDeviceForGrant] = useState<Device | null>(null);
  const [selectedDeviceForUnlock, setSelectedDeviceForUnlock] = useState<DeviceWithStatus | null>(null);
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices');
      const data = await res.json();
      if (data.devices) setDevices(data.devices);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const triggerFastPolling = () => {
    const timers = [
      setTimeout(fetchDevices, 600),
      setTimeout(fetchDevices, 1500),
      setTimeout(fetchDevices, 3000),
    ];
    return () => timers.forEach(clearTimeout);
  };

  useEffect(() => {
    fetchDevices();
    // Auto-refresh devices telemetry every 3 seconds
    const interval = setInterval(fetchDevices, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleLock = async (deviceId: string) => {
    // Optimistic UI update
    setDevices((prev) =>
      prev.map((d) =>
        d.id === deviceId
          ? {
              ...d,
              device_status:
                d.device_status && d.device_status.length > 0
                  ? [{ ...d.device_status[0], workstation_locked: true }]
                  : [{ workstation_locked: true }],
            }
          : d
      )
    );

    try {
      await fetch(`/api/devices/${deviceId}/lock`, { method: 'POST' });
      triggerFastPolling();
    } catch {
      fetchDevices();
    }
  };

  const handleUnlockSuccess = (unlockedDevice: Device | null) => {
    if (unlockedDevice) {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === unlockedDevice.id
            ? {
                ...d,
                device_status:
                  d.device_status && d.device_status.length > 0
                    ? [{ ...d.device_status[0], workstation_locked: false }]
                    : [{ workstation_locked: false }],
              }
            : d
        )
      );
    }
    triggerFastPolling();
  };

  const filteredDevices = devices.filter(
    (d) =>
      (d.deviceName || (d as any).device_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.hostname && d.hostname.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_10px_#00e5ff] animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#00e5ff] font-semibold">
              Hardware Authority
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#f0f3f6] flex items-center gap-2 mt-1">
            <Laptop className="w-6 h-6 text-[#00e5ff]" />
            My Registered Computers
          </h1>
          <p className="text-xs text-[#8b949e]">
            Cryptographically enrolled Windows PCs authorized under your zero-knowledge key
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsRefreshing(true);
              fetchDevices();
            }}
            className="p-2.5 rounded-2xl apple-btn-secondary"
            title="Refresh Devices"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#00e5ff]' : 'text-[#8b949e]'}`} />
          </button>

          <button
            onClick={() => setIsPairModalOpen(true)}
            className="px-5 py-2.5 rounded-2xl text-xs font-semibold text-white apple-btn-primary flex items-center gap-2 shadow-[0_0_20px_rgba(0,102,255,0.4)]"
          >
            <Plus className="w-4 h-4" />
            <span>Pair New Machine</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#8b949e]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter computers by name, hostname, or UUID..."
          className="w-full pl-10 pr-4 py-2.5 apple-input text-xs font-mono text-[#f0f3f6]"
        />
      </div>

      {/* Grid of Devices */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 rounded-3xl glass-card animate-pulse" />
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl glass-card space-y-4 border border-white/[0.08] relative overflow-hidden">
          <CornerOrb position="top-right" variant="cyan" size="sm" active />
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#00e5ff] mx-auto shadow-inner">
            <Laptop className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[#f0f3f6]">
              {searchTerm ? 'No matching machines found' : 'No computers enrolled yet'}
            </h3>
            <p className="text-xs text-[#8b949e] max-w-sm mx-auto">
              {searchTerm
                ? `No machines match "${searchTerm}". Try a different filter keyword.`
                : 'Install the iLock Windows Agent and pair your computer to monitor and control it.'}
            </p>
          </div>
          {!searchTerm && (
            <button
              onClick={() => setIsPairModalOpen(true)}
              className="px-6 py-2.5 text-xs font-semibold text-white apple-btn-primary rounded-full transition-all shadow-[0_0_20px_rgba(0,102,255,0.4)]"
            >
              + Pair First Machine
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onGrantAccess={(dev) => setSelectedDeviceForGrant(dev)}
              onLock={handleLock}
              onUnlock={(dev) => setSelectedDeviceForUnlock(dev)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <GrantAccessModal
        device={selectedDeviceForGrant}
        isOpen={!!selectedDeviceForGrant}
        onClose={() => setSelectedDeviceForGrant(null)}
        onSuccess={fetchDevices}
      />

      <PairDeviceModal
        isOpen={isPairModalOpen}
        onClose={() => setIsPairModalOpen(false)}
        onDeviceRegistered={fetchDevices}
      />

      <BiometricUnlockModal
        device={selectedDeviceForUnlock}
        isOpen={!!selectedDeviceForUnlock}
        onClose={() => setSelectedDeviceForUnlock(null)}
        onSuccess={() => handleUnlockSuccess(selectedDeviceForUnlock)}
      />
    </div>
  );
}
