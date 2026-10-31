'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  X,
  Radio,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Crosshair,
  History,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type { DeviceLocationFix } from '@ilock/shared';
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
  isOnline: boolean;
}

// Agent live mode expires on its own; the modal renews it while open
const LIVE_DURATION_S = 180;
const LIVE_RENEW_MS = 150 * 1000;
const LIVE_FRESH_MS = 60 * 1000;
// IP geolocation has no accuracy figure; draw a nominal city-level radius
const IP_APPROX_RADIUS_M = 5000;

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function LocationModal({
  isOpen,
  onClose,
  deviceId,
  deviceName,
  isOnline,
}: LocationModalProps) {
  const [latest, setLatest] = useState<DeviceLocationFix | null>(null);
  const [history, setHistory] = useState<DeviceLocationFix[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const hasCenteredRef = useRef(false);

  useBodyScrollLock(isOpen);

  const fetchLocation = async () => {
    try {
      const res = await fetch(`/api/devices/${deviceId}/location`);
      const data = await res.json();
      if (res.ok) {
        setLatest(data.latest);
        setHistory(data.history || []);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const sendLive = async (enabled: boolean) => {
    const res = await fetch(`/api/devices/${deviceId}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, durationSeconds: LIVE_DURATION_S }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to update live tracking');
  };

  const handleToggleLive = async () => {
    setIsToggling(true);
    setStatusMessage(null);
    try {
      await sendLive(!isLive);
      setIsLive(!isLive);
      setStatusMessage({
        type: 'success',
        text: !isLive ? 'Live tracking requested — first fix can take up to 15s' : 'Live tracking stopped',
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsToggling(false);
    }
  };

  const handleClose = () => {
    if (isLive) {
      sendLive(false).catch(() => {});
      setIsLive(false);
    }
    setStatusMessage(null);
    onClose();
  };

  const handleCopy = async () => {
    if (!latest) return;
    try {
      await navigator.clipboard.writeText(`${latest.latitude.toFixed(6)}, ${latest.longitude.toFixed(6)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  // Poll faster while live tracking
  useEffect(() => {
    if (!isOpen) return;
    fetchLocation();
    const interval = setInterval(fetchLocation, isLive ? 5000 : 30000);
    return () => clearInterval(interval);
  }, [isOpen, deviceId, isLive]);

  // Renew agent live mode before it expires
  useEffect(() => {
    if (!isOpen || !isLive) return;
    const interval = setInterval(() => sendLive(true).catch(() => {}), LIVE_RENEW_MS);
    return () => clearInterval(interval);
  }, [isOpen, isLive, deviceId]);

  // Leaflet touches window, so it is loaded client-side only
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapElRef.current) return;
      leafletRef.current = L;

      const map = L.map(mapElRef.current, { zoomControl: true }).setView([20, 0], 2);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 50);
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      hasCenteredRef.current = false;
      setMapReady(false);
    };
  }, [isOpen]);

  // Redraw marker, accuracy circle and trail
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;

    layer.clearLayers();

    const trail = [...history].reverse().map((p) => [p.latitude, p.longitude] as [number, number]);
    if (trail.length > 1) {
      L.polyline(trail, { color: '#00e5ff', weight: 2, opacity: 0.5, dashArray: '4 6' }).addTo(layer);
    }
    history.forEach((p) => {
      L.circleMarker([p.latitude, p.longitude], { radius: 3, color: '#64748b', weight: 1, fillOpacity: 0.8 })
        .bindTooltip(new Date(p.fixedAt).toLocaleString())
        .addTo(layer);
    });

    if (latest) {
      const pos: [number, number] = [latest.latitude, latest.longitude];
      const isIp = latest.source === 'ip';
      const color = isIp ? '#f59e0b' : '#00e5ff';
      const radius = isIp ? IP_APPROX_RADIUS_M : latest.accuracyM ?? 0;

      if (radius > 0) {
        L.circle(pos, { radius, color, weight: 1, fillOpacity: 0.12, dashArray: isIp ? '6 6' : undefined }).addTo(layer);
      }
      L.circleMarker(pos, { radius: 7, color: '#ffffff', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(layer);

      if (!hasCenteredRef.current) {
        map.setView(pos, isIp ? 11 : 16);
        hasCenteredRef.current = true;
      } else if (isLive) {
        map.panTo(pos);
      }
    }
  }, [mapReady, latest, history, isLive]);

  if (!isOpen) return null;

  const fixAgeMs = latest ? Date.now() - new Date(latest.fixedAt).getTime() : Infinity;
  const showLiveBadge = isLive && isOnline && fixAgeMs < LIVE_FRESH_MS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto overscroll-contain">
      <div className="relative w-full max-w-2xl bg-cyber-card border border-cyber-border rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto overscroll-contain my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyber-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Laptop Location
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    showLiveBadge
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 animate-pulse'
                      : 'bg-slate-800/80 text-slate-400 border-slate-700'
                  }`}
                >
                  {showLiveBadge ? 'LIVE' : 'LAST KNOWN'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {deviceName} • Windows Location with IP fallback
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {!isOnline && latest && (
          <div className="mt-4 p-3 rounded-xl text-xs flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Device is offline. Showing last known location from {timeAgo(latest.fixedAt)}.</span>
          </div>
        )}

        {/* Map */}
        <div className="relative mt-4 rounded-2xl overflow-hidden border border-cyber-border isolate">
          <div ref={mapElRef} className="ilock-map h-64 sm:h-80 w-full bg-slate-950" />
          {!isLoading && !latest && (
            <div className="absolute inset-0 z-[500] flex flex-col items-center justify-center text-center p-6 bg-slate-950/85">
              <MapPin className="w-8 h-8 mb-2 text-slate-600" />
              <p className="text-xs text-slate-300 font-semibold">No location reported yet</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                On the laptop, enable Settings → Privacy &amp; security → Location, including
                &quot;Let desktop apps access your location&quot;.
              </p>
            </div>
          )}
        </div>

        {/* Fix Details */}
        {latest && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" /> Fixed
              </p>
              <p className="text-xs text-white font-semibold mt-0.5">{timeAgo(latest.fixedAt)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
                <Crosshair className="w-3 h-3" /> Accuracy
              </p>
              <p className={`text-xs font-semibold mt-0.5 ${latest.source === 'ip' ? 'text-amber-300' : 'text-white'}`}>
                {latest.source === 'ip'
                  ? 'City-level (IP)'
                  : latest.accuracyM !== null
                    ? `±${Math.round(latest.accuracyM)} m`
                    : 'Unknown'}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 text-left transition-colors"
              title="Copy coordinates"
            >
              <p className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Coords
              </p>
              <p className="text-[11px] text-white font-mono mt-0.5 truncate">
                {latest.latitude.toFixed(5)}, {latest.longitude.toFixed(5)}
              </p>
            </button>
            <a
              href={`https://www.google.com/maps?q=${latest.latitude},${latest.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 transition-colors"
            >
              <p className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Navigate
              </p>
              <p className="text-xs text-cyan-300 font-semibold mt-0.5">Open in Maps</p>
            </a>
          </div>
        )}

        {/* Trail */}
        <div className="flex items-center justify-between mt-4 mb-2">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <History className="w-3.5 h-3.5 text-cyan-400" />
            Movement Trail (7 days)
          </h4>
          <button
            onClick={fetchLocation}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        <div className="overflow-y-auto space-y-1.5 pr-1 custom-scrollbar overscroll-contain touch-pan-y max-h-40">
          {history.length === 0 ? (
            <div className="text-center py-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-slate-500 text-xs font-mono">
              No movement recorded yet.
            </div>
          ) : (
            history.slice(0, 20).map((p, idx) => (
              <div
                key={`${p.fixedAt}-${idx}`}
                className="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3"
              >
                <p className="text-[11px] text-slate-300 font-mono truncate">
                  {p.city || `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}
                  <span className="text-slate-500"> • {p.source === 'ip' ? 'IP' : `±${Math.round(p.accuracyM ?? 0)} m`}</span>
                </p>
                <p className="text-[11px] text-slate-500 font-mono shrink-0">{new Date(p.fixedAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-cyber-border flex items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">
            {isOnline ? 'Live mode samples every 10s; otherwise every 5 min.' : 'Live tracking unavailable while offline.'}
          </p>
          <button
            onClick={handleToggleLive}
            disabled={isToggling || !isOnline}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none ${
              isLive
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                : 'bg-cyan-500 hover:bg-cyan-400 text-black'
            }`}
          >
            <Radio className="w-4 h-4" />
            {isLive ? 'Stop Live' : 'Track Live'}
          </button>
        </div>
      </div>
    </div>
  );
}
