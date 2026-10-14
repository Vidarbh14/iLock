'use client';

import React, { useState, useEffect } from 'react';
import {
  Monitor,
  RefreshCw,
  Eye,
  EyeOff,
  Maximize2,
  X,
  AlertTriangle,
  Clock,
  Sparkles,
  Camera,
} from 'lucide-react';

interface ScreenPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
}

export function ScreenPreviewModal({
  isOpen,
  onClose,
  deviceId,
  deviceName,
}: ScreenPreviewModalProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [privacyBlur, setPrivacyBlur] = useState(false);
  const [activeTab, setActiveTab] = useState<'screen' | 'camera'>('screen');
  const [cameraSnapshot, setCameraSnapshot] = useState<string | null>(null);
  const [cameraCapturedAt, setCameraCapturedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPreviews = async () => {
    setIsLoading(true);
    try {
      const [screenRes, camRes] = await Promise.all([
        fetch(`/api/devices/${deviceId}/screen`),
        fetch(`/api/devices/${deviceId}/camera`),
      ]);

      const [screenData, camData] = await Promise.all([screenRes.json(), camRes.json()]);

      if (screenData?.screenshot) {
        setScreenshot(screenData.screenshot);
        setCapturedAt(screenData.capturedAt);
      }
      if (camData?.cameraSnapshot) {
        setCameraSnapshot(camData.cameraSnapshot);
        setCameraCapturedAt(camData.capturedAt);
      }
    } catch {
      // Ignored
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPreviews();
    }
  }, [isOpen, deviceId]);

  const triggerCapture = async () => {
    setIsCapturing(true);
    setError(null);
    try {
      const endpoint = activeTab === 'screen' ? 'screen' : 'camera';
      const res = await fetch(`/api/devices/${deviceId}/${endpoint}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Capture command failed');
      }

      // Sequential polling for workstation agent response
      setTimeout(fetchPreviews, 1500);
      setTimeout(fetchPreviews, 3200);
      setTimeout(fetchPreviews, 5500);
      setTimeout(() => {
        fetchPreviews();
        setIsCapturing(false);
      }, 7500);
    } catch (err: any) {
      setError(err.message || 'Capture failed');
      setIsCapturing(false);
    }
  };

  if (!isOpen) return null;

  const currentImage = activeTab === 'screen' ? screenshot : cameraSnapshot;
  const currentTimestamp = activeTab === 'screen' ? capturedAt : cameraCapturedAt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-2xl border border-black/[0.08] rounded-3xl shadow-2xl max-w-2xl w-full p-6 text-[#1d1d1f] relative flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 text-[#86868b] hover:text-[#1d1d1f] rounded-full hover:bg-black/[0.04] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pr-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black/[0.04] flex items-center justify-center">
              {activeTab === 'screen' ? (
                <Monitor className="w-5 h-5 text-[#0071e3]" />
              ) : (
                <Camera className="w-5 h-5 text-indigo-600" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">Live Remote Visualizer</h3>
              <p className="text-xs text-[#86868b]">{deviceName}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-black/[0.04] rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('screen')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'screen' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Screen
            </button>
            <button
              onClick={() => setActiveTab('camera')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'camera' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Webcam
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Screen / Frame Container */}
        <div className="relative aspect-video rounded-2xl bg-black/[0.9] overflow-hidden flex items-center justify-center border border-black/[0.1] shadow-inner mb-5">
          {currentImage ? (
            <img
              src={currentImage}
              alt="Remote View"
              className={`w-full h-full object-contain transition-all duration-300 ${
                privacyBlur ? 'blur-md scale-105' : 'blur-0'
              }`}
            />
          ) : (
            <div className="text-center p-6 text-white/60">
              {isLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <span className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span className="text-xs">Fetching frame from workstation...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Monitor className="w-10 h-10 text-white/30" />
                  <p className="text-xs">No snapshot available yet.</p>
                  <p className="text-[11px] text-white/40">Tap &ldquo;Capture Snapshot&rdquo; to command your PC.</p>
                </div>
              )}
            </div>
          )}

          {/* Privacy Blur Overlay indicator */}
          {privacyBlur && currentImage && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
              <span className="px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
                Privacy Shield Active
              </span>
            </div>
          )}
        </div>

        {/* Controls Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#86868b]">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {currentTimestamp
                ? `Captured ${new Date(currentTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'Awaiting capture'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPrivacyBlur(!privacyBlur)}
              className="p-2.5 rounded-xl border border-black/[0.08] hover:bg-black/[0.03] text-[#1d1d1f] text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Toggle Privacy Blur"
            >
              {privacyBlur ? <EyeOff className="w-4 h-4 text-[#0071e3]" /> : <Eye className="w-4 h-4 text-[#86868b]" />}
              <span>{privacyBlur ? 'Unblur' : 'Blur'}</span>
            </button>

            <button
              onClick={triggerCapture}
              disabled={isCapturing}
              className="py-2.5 px-4 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCapturing ? 'animate-spin' : ''}`} />
              <span>{isCapturing ? 'Capturing...' : 'Capture Snapshot'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
