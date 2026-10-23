'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Play,
  Square,
  Radio,
  Zap,
  BatteryCharging,
  Shield,
  Activity,
  Layers,
} from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase-client';

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
  // Tabs: 'live' (Real-time balanced streaming), 'screen' (static snapshot), 'camera' (webcam)
  const [activeTab, setActiveTab] = useState<'live' | 'screen' | 'camera'>('live');

  // Live Stream state
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStartingStream, setIsStartingStream] = useState(false);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [activeWindow, setActiveWindow] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(4.0);
  const [latencyMs, setLatencyMs] = useState<number>(120);
  const [bandwidthKbs, setBandwidthKbs] = useState<number>(85);
  const [streamSessionId, setStreamSessionId] = useState<string | null>(null);
  const [lastFrameTime, setLastFrameTime] = useState<number | null>(null);

  // Static snapshots state
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [cameraSnapshot, setCameraSnapshot] = useState<string | null>(null);
  const [cameraCapturedAt, setCameraCapturedAt] = useState<string | null>(null);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState(false);

  // Visual filters
  const [privacyBlur, setPrivacyBlur] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // References
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  // Clean stop stream function
  const stopLiveStream = useCallback(async () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (channelRef.current) {
      try {
        channelRef.current.unsubscribe();
      } catch {}
      channelRef.current = null;
    }

    setIsStreaming(false);
    setIsStartingStream(false);

    try {
      await fetch(`/api/devices/${deviceId}/stream/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Best effort cleanup
    }
  }, [deviceId]);

  // Handle stream start
  const startLiveStream = async () => {
    setIsStartingStream(true);
    setError(null);

    try {
      const res = await fetch(`/api/devices/${deviceId}/stream/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality: 'balanced', targetFps: 4 }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to initialize live screen stream');
      }

      const sId = data.streamSessionId;
      setStreamSessionId(sId);
      setIsStreaming(true);
      setIsStartingStream(false);

      // 1. Subscribe to Supabase Realtime channel for ultra-low latency WebSocket push
      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient();
          const channel = supabase.channel(`device-stream:${deviceId}`);
          
          const handleBroadcastPayload = (payload: any) => {
            const frameData = payload?.payload || payload;
            if (frameData?.frameBase64) {
              const now = Date.now();
              setLiveFrame(frameData.frameBase64);
              if (frameData.activeWindow) setActiveWindow(frameData.activeWindow);
              if (frameData.fps) setFps(frameData.fps);
              if (frameData.timestamp) {
                setLatencyMs(Math.max(40, Math.min(600, now - frameData.timestamp)));
              }
              const bytes = frameData.frameBase64.length * 0.75;
              setBandwidthKbs(Math.round((bytes * (frameData.fps || 4)) / 1024));
              setLastFrameTime(now);
            }
          };

          channel
            .on('broadcast', { event: 'frame' }, handleBroadcastPayload)
            .subscribe((status: string) => {
              console.log('[Live Stream] Realtime subscription status:', status);
            });

          channelRef.current = channel;
        } catch (e) {
          console.warn('[Live Stream] Realtime subscription notice:', e);
        }
      }

      // 2. High-speed adaptive polling fallback (runs every 250ms to ensure continuous smooth rendering)
      pollIntervalRef.current = setInterval(async () => {
        try {
          const frameRes = await fetch(`/api/devices/${deviceId}/stream/latest`);
          if (frameRes.ok) {
            const frameData = await frameRes.json();
            if (frameData?.frame?.frameBase64) {
              const now = Date.now();
              setLiveFrame(frameData.frame.frameBase64);
              if (frameData.frame.activeWindow) setActiveWindow(frameData.frame.activeWindow);
              if (frameData.frame.fps) setFps(frameData.frame.fps);
              if (frameData.frame.timestamp) {
                setLatencyMs(Math.max(45, Math.min(500, now - frameData.frame.timestamp)));
              }
              const bytes = frameData.frame.frameBase64.length * 0.75;
              setBandwidthKbs(Math.round((bytes * (frameData.frame.fps || 4)) / 1024));
              setLastFrameTime(now);
            }
          }
        } catch {
          // Transient poll skip
        }
      }, 250);

      // 3. Keep-alive ping interval (every 10 seconds).
      // If the phone locks, browser sleeps, or network disconnects,
      // pings cease and the Windows agent automatically terminates screen capture after 25s!
      pingIntervalRef.current = setInterval(async () => {
        try {
          await fetch(`/api/devices/${deviceId}/stream/ping`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ streamSessionId: sId }),
          });
        } catch {}
      }, 10000);
    } catch (err: any) {
      setError(err.message || 'Could not start live stream. Please check connection.');
      setIsStartingStream(false);
      setIsStreaming(false);
    }
  };

  // Fetch static snapshots
  const fetchSnapshots = async () => {
    setIsLoadingSnapshots(true);
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
      setIsLoadingSnapshots(false);
    }
  };

  // Trigger static snapshot
  const triggerCaptureSnapshot = async () => {
    setIsCapturingSnapshot(true);
    setError(null);
    try {
      const endpoint = activeTab === 'camera' ? 'camera' : 'screen';
      const res = await fetch(`/api/devices/${deviceId}/${endpoint}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Capture command failed');
      }

      setTimeout(fetchSnapshots, 1500);
      setTimeout(fetchSnapshots, 3500);
      setTimeout(() => {
        fetchSnapshots();
        setIsCapturingSnapshot(false);
      }, 6000);
    } catch (err: any) {
      setError(err.message || 'Capture failed');
      setIsCapturingSnapshot(false);
    }
  };

  // Lifecycle: When modal opens or deviceId changes
  useEffect(() => {
    if (isOpen) {
      fetchSnapshots();
    } else {
      // Automatically shut down live streaming when modal is closed
      stopLiveStream();
    }
  }, [isOpen, deviceId, stopLiveStream]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopLiveStream();
    };
  }, [stopLiveStream]);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#12161f] border border-cyan-500/30 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] max-w-2xl w-full p-5 sm:p-6 text-slate-100 relative flex flex-col max-h-[92vh] overflow-hidden">
        {/* Close Button */}
        <button
          onClick={() => {
            stopLiveStream();
            onClose();
          }}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/[0.06] transition-colors z-20"
          title="Close Visualizer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pr-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,229,255,0.2)]">
              {activeTab === 'live' ? (
                <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
              ) : activeTab === 'screen' ? (
                <Monitor className="w-5 h-5 text-blue-400" />
              ) : (
                <Camera className="w-5 h-5 text-indigo-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Remote Screen Visualizer</h3>
                {isStreaming && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                    ● LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">{deviceName}</p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/80 border border-slate-700/60 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('live')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'live'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              Live Stream
            </button>
            <button
              onClick={() => setActiveTab('screen')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'screen'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Snapshot
            </button>
            <button
              onClick={() => setActiveTab('camera')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'camera'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Webcam
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 mb-3 animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Video / Screen Display Container */}
        <div
          ref={videoContainerRef}
          className="relative aspect-video rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner mb-4 group"
        >
          {/* Active Window Title Pill */}
          {activeTab === 'live' && isStreaming && activeWindow && (
            <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[11px] font-mono text-cyan-300 flex items-center gap-1.5 max-w-[80%] truncate shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="truncate">{activeWindow}</span>
            </div>
          )}

          {/* Telemetry HUD Pill (FPS, Latency, Bitrate) */}
          {activeTab === 'live' && isStreaming && (
            <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-mono text-slate-300 flex items-center gap-2 shadow-md">
              <span className="text-emerald-400 font-bold">{fps.toFixed(1)} FPS</span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-400">{latencyMs}ms</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300">{bandwidthKbs} KB/s</span>
            </div>
          )}

          {/* Display Content: LIVE STREAM */}
          {activeTab === 'live' ? (
            isStreaming ? (
              liveFrame ? (
                <img
                  src={liveFrame}
                  alt="Live Workstation Screen"
                  className={`w-full h-full object-contain transition-all duration-150 ${
                    privacyBlur ? 'blur-lg scale-105' : 'blur-0'
                  }`}
                />
              ) : screenshot ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={screenshot}
                    alt="Preview Screen"
                    className="w-full h-full object-contain opacity-40 blur-[1px]"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-xs gap-3 text-center p-6 text-slate-300">
                    <span className="w-8 h-8 border-2 border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
                    <p className="text-xs font-mono text-cyan-300 font-semibold">Synchronizing live video pipeline with PC...</p>
                    <p className="text-[11px] text-slate-400 font-mono">Connecting via encrypted conduit (displaying recent preview)</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center p-6 text-slate-400">
                  <span className="w-8 h-8 border-2 border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
                  <p className="text-xs font-mono text-cyan-300 font-semibold">Synchronizing live video pipeline with PC...</p>
                  <p className="text-[11px] text-slate-500">Connecting via encrypted outbound conduit</p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center gap-3 text-center p-6 text-slate-400 max-w-sm">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Live Screen Sharing Idle</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Screen streaming only runs when requested from your phone, guaranteeing zero background battery drain.
                  </p>
                </div>
                <button
                  onClick={startLiveStream}
                  disabled={isStartingStream}
                  className="mt-2 py-2.5 px-5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black text-xs font-bold shadow-[0_0_20px_rgba(0,229,255,0.3)] transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {isStartingStream ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Requesting PC Stream...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-black" />
                      <span>Start Live Stream (Balanced 540p)</span>
                    </>
                  )}
                </button>
              </div>
            )
          ) : activeTab === 'screen' ? (
            /* STATIC SCREENSHOT */
            screenshot ? (
              <img
                src={screenshot}
                alt="Workstation Snapshot"
                className={`w-full h-full object-contain transition-all duration-300 ${
                  privacyBlur ? 'blur-lg scale-105' : 'blur-0'
                }`}
              />
            ) : (
              <div className="text-center p-6 text-slate-400">
                <Monitor className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-xs">No snapshot available yet.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Click &ldquo;Capture Snapshot&rdquo; to command your PC.</p>
              </div>
            )
          ) : (
            /* WEBCAM */
            cameraSnapshot ? (
              <img
                src={cameraSnapshot}
                alt="Webcam Surveillance"
                className={`w-full h-full object-contain transition-all duration-300 ${
                  privacyBlur ? 'blur-lg scale-105' : 'blur-0'
                }`}
              />
            ) : (
              <div className="text-center p-6 text-slate-400">
                <Camera className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-xs">No webcam snapshot available yet.</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Click &ldquo;Capture Webcam Frame&rdquo; to command your PC.</p>
              </div>
            )
          )}

          {/* Privacy Blur Indicator */}
          {privacyBlur && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none backdrop-blur-sm">
              <span className="px-3.5 py-1.5 rounded-full bg-slate-900/90 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-medium shadow-lg">
                Privacy Shield Active
              </span>
            </div>
          )}
        </div>

        {/* Footer Controls & Battery Guard Notice */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Status Note */}
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            {activeTab === 'live' ? (
              isStreaming ? (
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Active Session • Auto-stops if idle</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-slate-400">
                  <BatteryCharging className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Battery Saver Active • 0% background drain</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {(activeTab === 'screen' ? capturedAt : cameraCapturedAt)
                    ? `Captured ${new Date(
                        (activeTab === 'screen' ? capturedAt : cameraCapturedAt)!
                      ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : 'Awaiting snapshot'}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Fullscreen View"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Privacy Shield Button */}
            <button
              onClick={() => setPrivacyBlur(!privacyBlur)}
              className="py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Blur sensitive content"
            >
              {privacyBlur ? (
                <EyeOff className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{privacyBlur ? 'Unblur' : 'Blur'}</span>
            </button>

            {/* Tab-specific Main Action Button */}
            {activeTab === 'live' ? (
              isStreaming ? (
                <button
                  onClick={stopLiveStream}
                  className="py-2.5 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all flex items-center gap-2 active:scale-95"
                >
                  <Square className="w-3.5 h-3.5 fill-rose-300" />
                  <span>Stop Live Stream</span>
                </button>
              ) : (
                <button
                  onClick={startLiveStream}
                  disabled={isStartingStream}
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black text-xs font-bold shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>Start Live Stream</span>
                </button>
              )
            ) : (
              <button
                onClick={triggerCaptureSnapshot}
                disabled={isCapturingSnapshot || isLoadingSnapshots}
                className="py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold shadow-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isCapturingSnapshot || isLoadingSnapshots ? 'animate-spin' : ''
                  }`}
                />
                <span>
                  {isCapturingSnapshot
                    ? 'Capturing...'
                    : activeTab === 'camera'
                    ? 'Capture Webcam'
                    : 'Capture Snapshot'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
