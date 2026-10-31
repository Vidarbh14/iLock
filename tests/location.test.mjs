import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentHeartbeatSchema, LocationLiveSchema } from '../packages/shared/dist/schemas.js';
import {
  generateDeviceKeyPair,
  signPayload,
  buildHeartbeatSignaturePayload,
  verifyHeartbeatSignature,
} from '../packages/security/dist/index.js';
// Node >= 22.18 / 23.6 strips TypeScript types natively
import {
  resolveLocationFix,
  isNewFix,
  haversineMeters,
} from '../apps/web/lib/location-helper.ts';

const baseHeartbeat = {
  deviceUuid: 'device-uuid-1234',
  timestamp: Date.now(),
  nonce: 'a'.repeat(32),
  signature: 's'.repeat(32),
  workstationLocked: false,
};

const now = new Date('2026-10-30T10:00:00Z');
const minutesAgo = (m) => new Date(now.getTime() - m * 60 * 1000).toISOString();
const vercelHeaders = new Headers({
  'x-vercel-ip-latitude': '30.3165',
  'x-vercel-ip-longitude': '78.0322',
  'x-vercel-ip-city': 'Dehra%20Dun',
});

test('--- LAPTOP LOCATION (LIVE + LAST KNOWN) VERIFICATION ---', async (t) => {
  await t.test('1. Heartbeat schema accepts location fields and stays backward compatible', () => {
    assert.equal(AgentHeartbeatSchema.safeParse(baseHeartbeat).success, true);

    const withFix = AgentHeartbeatSchema.safeParse({
      ...baseHeartbeat,
      latitude: 30.2686,
      longitude: 77.9952,
      locationAccuracyM: 105,
      locationFixedAt: now.getTime(),
    });
    assert.equal(withFix.success, true);

    const nulls = AgentHeartbeatSchema.safeParse({ ...baseHeartbeat, latitude: null, longitude: null });
    assert.equal(nulls.success, true);

    assert.equal(AgentHeartbeatSchema.safeParse({ ...baseHeartbeat, latitude: 91, longitude: 0 }).success, false);
    assert.equal(AgentHeartbeatSchema.safeParse({ ...baseHeartbeat, latitude: 0, longitude: -181 }).success, false);
  });

  await t.test('2. Live location schema enforces duration bounds', () => {
    const parsed = LocationLiveSchema.safeParse({ enabled: true });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.durationSeconds, 120);
    assert.equal(LocationLiveSchema.safeParse({ enabled: true, durationSeconds: 5 }).success, false);
    assert.equal(LocationLiveSchema.safeParse({ enabled: true, durationSeconds: 3600 }).success, false);
  });

  await t.test('3. Haversine distance is accurate (1 degree latitude ~ 111.2 km)', () => {
    const d = haversineMeters(30, 78, 31, 78);
    assert.ok(Math.abs(d - 111195) < 100, `got ${d}`);
    assert.equal(haversineMeters(30, 78, 30, 78), 0);
  });

  await t.test('4. Agent Windows fix is preferred over IP headers', () => {
    const fix = resolveLocationFix(
      { ...baseHeartbeat, latitude: 30.2686, longitude: 77.9952, locationAccuracyM: 105, locationFixedAt: now.getTime() },
      vercelHeaders,
      null,
      now
    );
    assert.equal(fix.source, 'windows');
    assert.equal(fix.accuracyM, 105);
    assert.equal(fix.fixedAt, now.toISOString());
  });

  await t.test('5. IP fallback is used when the agent has no fix', () => {
    const fix = resolveLocationFix(baseHeartbeat, vercelHeaders, null, now);
    assert.equal(fix.source, 'ip');
    assert.equal(fix.city, 'Dehra Dun');
    assert.equal(fix.accuracyM, null);
  });

  await t.test('6. A recent precise fix is not overwritten by coarse IP location', () => {
    const recent = { latitude: 30.26, longitude: 77.99, location_source: 'windows', location_fixed_at: minutesAgo(10) };
    assert.equal(resolveLocationFix(baseHeartbeat, vercelHeaders, recent, now), null);

    const stale = { ...recent, location_fixed_at: minutesAgo(45) };
    assert.equal(resolveLocationFix(baseHeartbeat, vercelHeaders, stale, now).source, 'ip');
  });

  await t.test('7. No fix and no IP headers leaves the last known location untouched', () => {
    assert.equal(resolveLocationFix(baseHeartbeat, new Headers(), null, now), null);
  });

  await t.test('8. isNewFix de-duplicates repeated heartbeats carrying the same fix', () => {
    const fix = { latitude: 30.26, longitude: 77.99, accuracyM: 100, source: 'windows', city: null, fixedAt: minutesAgo(1) };
    const stored = { latitude: 30.26, longitude: 77.99, location_source: 'windows', location_fixed_at: fix.fixedAt };
    assert.equal(isNewFix(fix, stored), false);
    assert.equal(isNewFix({ ...fix, fixedAt: now.toISOString() }, stored), true);
    assert.equal(isNewFix(fix, null), true);

    const ipFix = { ...fix, source: 'ip', fixedAt: now.toISOString() };
    const ipStored = { ...stored, location_source: 'ip', location_fixed_at: minutesAgo(1) };
    assert.equal(isNewFix(ipFix, ipStored), false, 'same IP coords with a newer timestamp is not new');
  });
});

test('--- HEARTBEAT SIGNATURE VERIFICATION (v2 covers location) ---', async (t) => {
  const device = generateDeviceKeyPair(2048);
  const attacker = generateDeviceKeyPair(2048);
  const hb = {
    deviceUuid: 'device-uuid-1234',
    timestamp: 1793354400123,
    nonce: 'a'.repeat(32),
    workstationLocked: true,
    latitude: 30.268612,
    longitude: 77.995188,
    locationAccuracyM: 105,
    locationFixedAt: 1793354399000,
  };

  await t.test('1. Canonical v2 string uses fixed decimals and lowercase booleans', () => {
    assert.equal(
      buildHeartbeatSignaturePayload(hb),
      'v2:device-uuid-1234:1793354400123:' + 'a'.repeat(32) + ':true:30.268612:77.995188:105:1793354399000'
    );
    assert.equal(
      buildHeartbeatSignaturePayload({ ...hb, latitude: null, longitude: undefined, locationAccuracyM: null, locationFixedAt: null }),
      'v2:device-uuid-1234:1793354400123:' + 'a'.repeat(32) + ':true::::'
    );
  });

  await t.test('2. Valid v2 signature verifies; any tampered field is rejected', () => {
    const sig = signPayload(device.privateKey, buildHeartbeatSignaturePayload(hb));
    assert.equal(verifyHeartbeatSignature(device.publicKey, hb, sig), true);
    assert.equal(verifyHeartbeatSignature(device.publicKey, { ...hb, latitude: 30.268613 }, sig), false);
    assert.equal(verifyHeartbeatSignature(device.publicKey, { ...hb, locationFixedAt: hb.locationFixedAt + 1 }, sig), false);
    assert.equal(verifyHeartbeatSignature(device.publicKey, { ...hb, workstationLocked: false }, sig), false);
  });

  await t.test('3. Signature from a different key (spoofed device UUID) is rejected', () => {
    const forged = signPayload(attacker.privateKey, buildHeartbeatSignaturePayload(hb));
    assert.equal(verifyHeartbeatSignature(device.publicKey, hb, forged), false);
    assert.equal(verifyHeartbeatSignature(device.publicKey, hb, 'x'.repeat(64)), false);
  });

  await t.test('4. Legacy v1 signatures are accepted only for heartbeats without location', () => {
    const noLoc = { deviceUuid: hb.deviceUuid, timestamp: hb.timestamp, nonce: hb.nonce, workstationLocked: true };
    const csharpV1 = signPayload(device.privateKey, `${hb.deviceUuid}:${hb.timestamp}:${hb.nonce}:True`);
    const simulatorV1 = signPayload(device.privateKey, `${hb.deviceUuid}:${hb.timestamp}:${hb.nonce}:true`);
    assert.equal(verifyHeartbeatSignature(device.publicKey, noLoc, csharpV1), true);
    assert.equal(verifyHeartbeatSignature(device.publicKey, noLoc, simulatorV1), true);
    assert.equal(verifyHeartbeatSignature(device.publicKey, { ...noLoc, workstationLocked: false }, csharpV1), false);

    // A v1 signature cannot be used to attach an unsigned location
    assert.equal(verifyHeartbeatSignature(device.publicKey, hb, csharpV1), false);
  });
});
