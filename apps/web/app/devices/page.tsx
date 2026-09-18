'use client';

import React, { useEffect, useState } from 'react';
import { Laptop, Plus, RefreshCw, Search } from 'lucide-react';
import type { Device } from '@ilock/shared';
import { DeviceCard } from '@/components/DeviceCard';
import { GrantAccessModal } from '@/components/GrantAccessModal';
import { PairDeviceModal } from '@/components/PairDeviceModal';
import { BiometricUnlockModal } from '@/components/BiometricUnlockModal';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDeviceForGrant, setSelectedDeviceForGrant] = useState<Device | null>(null);
  const [selectedDeviceForUnlock, setSelectedDeviceForUnlock] = useState<Device | null>(null);
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

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleLock = async (deviceId: string) => {
    try {
      await fetch(`/api/devices/${deviceId}/lock`, { method: 'POST' });
      await fetchDevices();
    } catch {
      // Handled
    }
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
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Laptop className="w-6 h-6 text-cyan-400" />
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
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsPairModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
          >
            <Plus className="w-4 h-4" />
            Pair New PC
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter by device name or hostname..."
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-slate-900/50 animate-pulse" />
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="text-center py-12 rounded-2xl bg-slate-900/30 border border-slate-800/60">
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
        onSuccess={fetchDevices}
      />
    </div>
  );
}
