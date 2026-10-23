import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RemoteInputSchema,
  SpeechBroadcastSchema,
  ProcessActionSchema,
  SentryConfigSchema,
  FileConduitSchema,
  BleProximitySchema,
  WebPushSubscriptionSchema,
} from '../packages/shared/dist/schemas.js';

test('--- NEW ADVANCED FEATURES SCHEMA & PROTOCOL VERIFICATION ---', async (t) => {
  await t.test('1. Remote Input Schema accepts normalized clicks and keystrokes', () => {
    const validClick = RemoteInputSchema.safeParse({
      action: 'click',
      x: 0.5,
      y: 0.75,
      button: 'left',
    });
    assert.equal(validClick.success, true);
    assert.equal(validClick.data.action, 'click');

    const validMacro = RemoteInputSchema.safeParse({
      action: 'macro',
      macro: 'ALT_F4',
    });
    assert.equal(validMacro.success, true);

    const validKey = RemoteInputSchema.safeParse({
      action: 'keystrokes',
      text: 'Hello iLock Cloud!',
    });
    assert.equal(validKey.success, true);

    // Reject invalid coordinates outside 0..1
    const invalidCoord = RemoteInputSchema.safeParse({
      action: 'click',
      x: 1.5,
      y: -0.2,
    });
    assert.equal(invalidCoord.success, false);
  });

  await t.test('2. Sentry Security Guard Schema accepts arm/disarm and triggers', () => {
    const sentryArmed = SentryConfigSchema.safeParse({
      enabled: true,
      alarmOnTamper: true,
      snapOnFailedLogon: true,
      alertOnPowerDisconnect: true,
    });
    assert.equal(sentryArmed.success, true);
    assert.equal(sentryArmed.data.enabled, true);
    assert.equal(sentryArmed.data.alarmOnTamper, true);
  });

  await t.test('3. Process Manager Schema validates list and kill commands', () => {
    const listProc = ProcessActionSchema.safeParse({ action: 'list' });
    assert.equal(listProc.success, true);

    const killProc = ProcessActionSchema.safeParse({ action: 'kill', pid: 1420 });
    assert.equal(killProc.success, true);
    assert.equal(killProc.data.pid, 1420);
  });

  await t.test('4. Text-to-Speech (TTS) Broadcaster Schema validates audio properties', () => {
    const validSpeech = SpeechBroadcastSchema.safeParse({
      text: 'Attention: Workstation session will expire in 2 minutes.',
      volume: 90,
      rate: 1,
    });
    assert.equal(validSpeech.success, true);
    assert.equal(validSpeech.data.volume, 90);

    // Reject volume > 100
    const invalidVol = SpeechBroadcastSchema.safeParse({
      text: 'Too loud',
      volume: 150,
    });
    assert.equal(invalidVol.success, false);
  });

  await t.test('5. File Conduit Schema restricts access strictly to allowed folders', () => {
    const validFileAction = FileConduitSchema.safeParse({
      action: 'read',
      folder: 'desktop',
      fileName: 'Project_Report.pdf',
    });
    assert.equal(validFileAction.success, true);

    // Reject arbitrary paths like 'system32'
    const invalidFolder = FileConduitSchema.safeParse({
      action: 'read',
      folder: 'system32',
      fileName: 'cmd.exe',
    });
    assert.equal(invalidFolder.success, false);
  });

  await t.test('7. WebPush Subscription Schema validates endpoints and keys', () => {
    const validPush = WebPushSubscriptionSchema.safeParse({
      endpoint: 'https://fcm.googleapis.com/fcm/send/sample-token',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0448-',
        auth: 'tBHItJI5svbpez7KI4CCXg==',
      },
    });
    assert.equal(validPush.success, true);
  });

  await t.test('8. BLE Proximity Auto-Lock Schema validates RSSI threshold & timeout', () => {
    const validBle = BleProximitySchema.safeParse({
      enabled: true,
      rssiThreshold: -75,
      timeoutSeconds: 5,
    });
    assert.equal(validBle.success, true);
    assert.equal(validBle.data.rssiThreshold, -75);
    assert.equal(validBle.data.timeoutSeconds, 5);

    // Reject invalid threshold
    const invalidRssi = BleProximitySchema.safeParse({
      enabled: true,
      rssiThreshold: 50, // Positive RSSI is impossible
    });
    assert.equal(invalidRssi.success, false);
  });
});
