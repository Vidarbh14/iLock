import test from 'node:test';
import assert from 'node:assert/strict';
import { StartScreenStreamSchema } from '../packages/shared/dist/index.js';

test('--- LIVE SCREEN SHARING PROTOCOL & BATTERY-SAVER ---', async (t) => {
  // Mock in-memory stream state mirroring apps/web/lib/demo-store.ts & LiveScreenStreamer.cs
  const streamStore = {
    activeStreams: new Map(),
    latestFrames: new Map(),

    startStream(deviceId, quality = 'balanced', targetFps = 4, streamSessionId = 'test-session') {
      const session = {
        deviceId,
        streamSessionId,
        quality,
        targetFps,
        startedAt: Date.now(),
        lastPingAt: Date.now(),
        isActive: true,
      };
      this.activeStreams.set(deviceId, session);
      return session;
    },

    pingStream(deviceId) {
      const session = this.activeStreams.get(deviceId);
      if (session) {
        session.lastPingAt = Date.now();
        return true;
      }
      return false;
    },

    saveFrame(deviceId, frame) {
      this.latestFrames.set(deviceId, frame);
    },

    getLatestFrame(deviceId) {
      return this.latestFrames.get(deviceId) || null;
    },

    stopStream(deviceId) {
      const session = this.activeStreams.get(deviceId);
      if (session) {
        session.isActive = false;
        this.activeStreams.delete(deviceId);
        this.latestFrames.delete(deviceId);
      }
    },

    checkInactivityWatchdog(deviceId, maxInactivityMs = 25000) {
      const session = this.activeStreams.get(deviceId);
      if (!session) return { isActive: false, reason: 'NO_STREAM' };
      if (Date.now() - session.lastPingAt > maxInactivityMs) {
        this.stopStream(deviceId);
        return { isActive: false, reason: 'WATCHDOG_TIMEOUT' };
      }
      return { isActive: true, session };
    },
  };

  await t.test('1. Schema validation accepts balanced 540p streaming configuration', () => {
    const validConfig = {
      quality: 'balanced',
      targetFps: 4,
    };
    const parsed = StartScreenStreamSchema.safeParse(validConfig);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.quality, 'balanced');
      assert.equal(parsed.data.targetFps, 4);
    }

    // Default fallback
    const emptyConfig = {};
    const parsedDefault = StartScreenStreamSchema.safeParse(emptyConfig);
    assert.equal(parsedDefault.success, true);

    // Reject out-of-range FPS
    const invalidFps = { targetFps: 99 };
    const parsedInvalid = StartScreenStreamSchema.safeParse(invalidFps);
    assert.equal(parsedInvalid.success, false);
  });

  await t.test('2. Start stream activates on-demand session with unique session ID', () => {
    const deviceId = 'dev-pc-01';
    const session = streamStore.startStream(deviceId, 'balanced', 4, 'stream-uuid-1234');
    assert.equal(session.isActive, true);
    assert.equal(session.quality, 'balanced');
    assert.equal(session.targetFps, 4);
    assert.equal(session.streamSessionId, 'stream-uuid-1234');
  });

  await t.test('3. Client keep-alive ping refreshes lastPingAt timestamp', () => {
    const deviceId = 'dev-pc-01';
    const session = streamStore.activeStreams.get(deviceId);
    assert.ok(session);
    const initialPing = session.lastPingAt;

    // Simulate short delay
    session.lastPingAt = initialPing - 5000;
    const pingOk = streamStore.pingStream(deviceId);
    assert.equal(pingOk, true);
    assert.ok(session.lastPingAt > initialPing - 5000);
  });

  await t.test('4. Ingestion of screen stream frame caches HUD telemetry', () => {
    const deviceId = 'dev-pc-01';
    const mockFrame = {
      frameBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
      timestamp: Date.now(),
      fps: 4,
      activeWindow: 'Visual Studio Code - iLock',
      mouseX: 850,
      mouseY: 420,
      streamSessionId: 'stream-uuid-1234',
    };

    streamStore.saveFrame(deviceId, mockFrame);
    const retrieved = streamStore.getLatestFrame(deviceId);
    assert.ok(retrieved);
    assert.equal(retrieved.activeWindow, 'Visual Studio Code - iLock');
    assert.equal(retrieved.mouseX, 850);
    assert.equal(retrieved.mouseY, 420);
    assert.equal(retrieved.fps, 4);
  });

  await t.test('5. Battery-saver watchdog auto-terminates capture when viewer disconnects (>25s)', () => {
    const deviceId = 'dev-pc-01';
    const session = streamStore.activeStreams.get(deviceId);
    assert.ok(session);

    // Simulate viewer closed phone browser tab 30 seconds ago
    session.lastPingAt = Date.now() - 30000;

    const watchdogResult = streamStore.checkInactivityWatchdog(deviceId, 25000);
    assert.equal(watchdogResult.isActive, false);
    assert.equal(watchdogResult.reason, 'WATCHDOG_TIMEOUT');

    // Confirm session and frame data were cleaned up to release memory
    assert.equal(streamStore.activeStreams.has(deviceId), false);
    assert.equal(streamStore.getLatestFrame(deviceId), null);
  });

  await t.test('6. Explicit stop command gracefully returns workstation to idle state', () => {
    const deviceId = 'dev-pc-02';
    streamStore.startStream(deviceId, 'balanced', 4, 'stream-uuid-5678');
    assert.equal(streamStore.activeStreams.has(deviceId), true);

    streamStore.stopStream(deviceId);
    assert.equal(streamStore.activeStreams.has(deviceId), false);
    assert.equal(streamStore.getLatestFrame(deviceId), null);
  });
});
