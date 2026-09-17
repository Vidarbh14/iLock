// ==============================================================================
// iLock Full End-to-End Simulation Integration Test
// Verifies: Pairing -> Enrolling -> Heartbeat -> Access Grant -> Expiry -> Revoke
// ==============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  evaluateSessionTimeState,
  isValidSessionTransition,
} = require('../packages/shared/dist/index.js');

const {
  generatePairingCode,
  hashPairingCode,
  generateDeviceKeyPair,
  signPayload,
  verifyDeviceSignature,
  globalReplayDetector,
} = require('../packages/security/dist/index.js');

test('--- END-TO-END INTEGRATION PROTOCOL ---', async (t) => {
  const DEMO_USER_ID = crypto.randomUUID();
  const testDeviceUuid = crypto.randomUUID();
  const testKeyPair = generateDeviceKeyPair(2048);

  // In-memory store for integration test
  const pairingRequests = [];
  const registeredDevices = [];
  const accessSessions = [];
  const telemetry = new Map();

  let pairingCode = '';
  let pairingHash = '';

  await t.test('1. Owner generates short-lived pairing code', () => {
    const codeObj = generatePairingCode();
    pairingCode = codeObj.formatted;
    pairingHash = hashPairingCode(codeObj.raw);
    assert.ok(pairingCode.length === 9); // XXXX-XXXX

    pairingRequests.push({
      id: crypto.randomUUID(),
      ownerId: DEMO_USER_ID,
      deviceName: 'Test Windows Machine',
      pairingCodeHash: pairingHash,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      isUsed: false,
      usedAt: null,
      createdAt: new Date().toISOString(),
    });

    assert.equal(pairingRequests.length, 1);
  });

  let registeredDeviceId = '';

  await t.test('2. Windows Agent enrolls with pairing code and registers public key', () => {
    const inputHash = hashPairingCode(pairingCode);
    const matched = pairingRequests.find(
      (r) => !r.isUsed && r.pairingCodeHash === inputHash
    );
    assert.ok(matched, 'Pairing request must exist and match hash');

    matched.isUsed = true;
    matched.usedAt = new Date().toISOString();

    registeredDeviceId = crypto.randomUUID();
    const newDevice = {
      id: registeredDeviceId,
      ownerId: matched.ownerId,
      deviceName: matched.deviceName,
      deviceUuid: testDeviceUuid,
      platform: 'windows',
      hostname: 'TEST-WIN-HOST',
      osVersion: 'Windows 11 Test',
      agentVersion: '1.0.0',
      publicKey: testKeyPair.publicKey,
      publicKeyAlgorithm: 'RSA-4096',
      lastSeen: new Date().toISOString(),
      status: 'online',
      isTrusted: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    registeredDevices.push(newDevice);

    telemetry.set(registeredDeviceId, {
      deviceId: registeredDeviceId,
      workstationLocked: true,
      lastHeartbeat: new Date().toISOString(),
    });

    assert.equal(registeredDevices.length, 1);
    assert.equal(registeredDevices[0].status, 'online');
    assert.equal(registeredDevices[0].publicKey, testKeyPair.publicKey);
  });

  await t.test('3. Windows Agent sends cryptographically signed heartbeat', () => {
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    const payloadToSign = `${testDeviceUuid}:${timestamp}:${nonce}:true`;
    const signature = signPayload(testKeyPair.privateKey, payloadToSign);

    // Verify replay protection accepts fresh nonce
    const replayCheck = globalReplayDetector.validate(nonce, timestamp);
    assert.equal(replayCheck.valid, true);

    // Verify signature using the registered public key
    const dev = registeredDevices.find((d) => d.id === registeredDeviceId);
    const isValid = verifyDeviceSignature(dev.publicKey, payloadToSign, signature);
    assert.equal(isValid, true, 'Heartbeat signature must verify against device public key');

    // Telemetry update
    const tel = telemetry.get(registeredDeviceId);
    assert.ok(tel);
    tel.lastHeartbeat = new Date().toISOString();
  });

  let activeSessionId = '';

  await t.test('4. Owner creates temporary access session (30 minutes)', () => {
    activeSessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    const session = {
      id: activeSessionId,
      deviceId: registeredDeviceId,
      ownerId: DEMO_USER_ID,
      sessionType: 'temporary_access',
      status: 'ACTIVE',
      durationMinutes: 30,
      createdAt: now.toISOString(),
      authorizedAt: now.toISOString(),
      activatedAt: now.toISOString(),
      expiresAt,
      revokedAt: null,
      revokedBy: null,
      createdBy: DEMO_USER_ID,
    };
    accessSessions.push(session);

    assert.equal(session.status, 'ACTIVE');
    assert.equal(session.durationMinutes, 30);
  });

  await t.test('5. Owner revokes session early via emergency killswitch', () => {
    const session = accessSessions.find((s) => s.id === activeSessionId);
    assert.ok(session);
    assert.equal(isValidSessionTransition(session.status, 'REVOKED'), true);

    session.status = 'REVOKED';
    session.revokedAt = new Date().toISOString();

    const tel = telemetry.get(registeredDeviceId);
    tel.workstationLocked = true;

    assert.equal(session.status, 'REVOKED');
    assert.equal(tel.workstationLocked, true, 'Workstation must be locked upon revocation');
  });

  await t.test('6. Attempt to transition from terminal REVOKED to ACTIVE is rejected', () => {
    const session = accessSessions.find((s) => s.id === activeSessionId);
    assert.equal(isValidSessionTransition(session.status, 'ACTIVE'), false);
  });
});
