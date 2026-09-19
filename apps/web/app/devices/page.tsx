'use client';

import React, { useEffect, useState } from 'react';
import { Laptop, Plus, RefreshCw, Search } from 'lucide-react';
import type { Device } from '@ilock/shared';
import { DeviceCard } from '@/components/DeviceCard';
import { GrantAccessModal } from '@/components/GrantAccessModal';
import { PairDeviceModal } from '@/components/PairDeviceModal';
import { BiometricUnlockModal } from '@/components/BiometricUnlockModal';

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
      d.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.hostname && d.hostname.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Laptop className="w-6 h-6 text-[#2997ff]" />
            Registered Computers
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your paired Windows workstations and security identities
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsRefreshing(true);
              fetchDevices();
            }}
            className="p-2 rounded-full apple-btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsPairModalOpen(true)}
            className="px-4 py-2 rounded-full text-xs font-medium apple-btn-primary flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Pair New PC
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter by device name or hostname..."
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl apple-input text-sm text-white placeholder-slate-500"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl glass-card animate-pulse" />
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="text-center py-12 rounded-3xl glass-card">
          <p className="text-sm text-slate-400">No computers found matching your filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onGrantAccess={(d) => setSelectedDeviceForGrant(d)}
              onLock={handleLock}
              onUnlock={(d) => setSelectedDeviceForUnlock(d)}
            />
          ))}
        </div>
      )}

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
