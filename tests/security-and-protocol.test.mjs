// ==============================================================================
// iLock Security, Protocol, Cryptography & State Machine Automated Test Suite
// ==============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  isValidSessionTransition,
  assertValidTransition,
  isRevocable,
  isCurrentlyActive,
  evaluateSessionTimeState,
  InvalidStateTransitionError,
} = require('../packages/shared/dist/index.js');

const {
  generatePairingCode,
  hashPairingCode,
  constantTimeCompare,
  hashIpAddress,
  generateChallengeNonce,
  generateDeviceKeyPair,
  signPayload,
  verifyDeviceSignature,
  SlidingWindowRateLimiter,
  ReplayDetector,
} = require('../packages/security/dist/index.js');

test('--- STATE MACHINE & LIFECYCLE ---', async (t) => {
  await t.test('allows valid lifecycle progression: PENDING -> AUTHORIZED -> ACTIVE -> EXPIRING -> EXPIRED', () => {
    assert.equal(isValidSessionTransition('PENDING', 'AUTHORIZED'), true);
    assert.equal(isValidSessionTransition('AUTHORIZED', 'ACTIVE'), true);
    assert.equal(isValidSessionTransition('ACTIVE', 'EXPIRING'), true);
    assert.equal(isValidSessionTransition('EXPIRING', 'EXPIRED'), true);
  });

  await t.test('allows early revocation from active states', () => {
    assert.equal(isValidSessionTransition('PENDING', 'REVOKED'), true);
    assert.equal(isValidSessionTransition('AUTHORIZED', 'REVOKED'), true);
    assert.equal(isValidSessionTransition('ACTIVE', 'REVOKED'), true);
    assert.equal(isValidSessionTransition('EXPIRING', 'REVOKED'), true);
  });

  await t.test('strictly prohibits resurrection from terminal states', () => {
    // Once EXPIRED, cannot become ACTIVE or AUTHORIZED
    assert.equal(isValidSessionTransition('EXPIRED', 'ACTIVE'), false);
    assert.equal(isValidSessionTransition('EXPIRED', 'AUTHORIZED'), false);
    assert.equal(isValidSessionTransition('EXPIRED', 'REVOKED'), false);

    // Once REVOKED, cannot become ACTIVE
    assert.equal(isValidSessionTransition('REVOKED', 'ACTIVE'), false);
    assert.equal(isValidSessionTransition('REVOKED', 'EXPIRING'), false);

    // Once FAILED, cannot become ACTIVE
    assert.equal(isValidSessionTransition('FAILED', 'ACTIVE'), false);
  });

  await t.test('assertValidTransition throws on illegal state jumps', () => {
    assert.throws(
      () => assertValidTransition('EXPIRED', 'ACTIVE'),
      InvalidStateTransitionError
    );
  });

  await t.test('isRevocable checks terminal boundaries accurately', () => {
    assert.equal(isRevocable('ACTIVE'), true);
    assert.equal(isRevocable('EXPIRING'), true);
    assert.equal(isRevocable('AUTHORIZED'), true);
    assert.equal(isRevocable('EXPIRED'), false);
    assert.equal(isRevocable('REVOKED'), false);
    assert.equal(isRevocable('FAILED'), false);
  });

  await t.test('evaluateSessionTimeState transitions based on server time, not client clock', () => {
    const now = new Date('2026-09-17T12:00:00Z');

    // Future expiration -> remains ACTIVE
    const futureExpiry = new Date('2026-09-17T12:30:00Z');
    assert.equal(evaluateSessionTimeState('ACTIVE', futureExpiry, now), 'ACTIVE');

    // Within 5 minutes -> becomes EXPIRING
    const nearExpiry = new Date('2026-09-17T12:03:00Z');
    assert.equal(evaluateSessionTimeState('ACTIVE', nearExpiry, now), 'EXPIRING');

    // Past expiration -> becomes EXPIRED
    const pastExpiry = new Date('2026-09-17T11:59:00Z');
    assert.equal(evaluateSessionTimeState('ACTIVE', pastExpiry, now), 'EXPIRED');

    // Terminal states never change
    assert.equal(evaluateSessionTimeState('REVOKED', futureExpiry, now), 'REVOKED');
  });
});

test('--- CRYPTOGRAPHIC PRIMITIVES & SECURITY ---', async (t) => {
  await t.test('pairing codes generate uppercase high-entropy alphanumeric strings', () => {
    const { formatted, raw } = generatePairingCode();
    assert.equal(raw.length, 8);
    assert.match(formatted, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    // Disallows ambiguous characters 0, O, 1, I
    assert.equal(/[01OI]/.test(raw), false);
  });

  await t.test('constantTimeCompare prevents timing analysis', () => {
    const hashA = hashPairingCode('ABCD-EFGH');
    const hashB = hashPairingCode('ABCD-EFGH');
    const hashC = hashPairingCode('WXYZ-1234');

    assert.equal(constantTimeCompare(hashA, hashB), true);
    assert.equal(constantTimeCompare(hashA, hashC), false);
    assert.equal(constantTimeCompare(hashA, 'short'), false);
  });

  await t.test('asymmetric RSA keypair generation, signing, and signature verification', () => {
    const { publicKey, privateKey } = generateDeviceKeyPair(2048);
    assert.ok(publicKey.includes('BEGIN PUBLIC KEY'));
    assert.ok(privateKey.includes('BEGIN PRIVATE KEY'));

    const payload = 'device-uuid-1234:1726588800000:nonce-abc:locked=true';
    const signature = signPayload(privateKey, payload);
    assert.ok(signature.length > 32);

    // Verify valid signature
    const isValid = verifyDeviceSignature(publicKey, payload, signature);
    assert.equal(isValid, true);

    // Tampered payload fails verification
    const tampered = payload + '_tampered';
    const isTamperedValid = verifyDeviceSignature(publicKey, tampered, signature);
    assert.equal(isTamperedValid, false);

    // Different key fails verification
    const otherKeyPair = generateDeviceKeyPair(2048);
    const isOtherKeyValid = verifyDeviceSignature(otherKeyPair.publicKey, payload, signature);
    assert.equal(isOtherKeyValid, false);
  });

  await t.test('privacy-preserving IP hashing obscures raw client IP', () => {
    const rawIp = '198.51.100.42';
    const hash = hashIpAddress(rawIp);
    assert.notEqual(hash, rawIp);
    assert.equal(hash.length, 16);
    assert.equal(hashIpAddress(rawIp), hash); // Deterministic with salt
  });
});

test('--- REPLAY ATTACK & TIME SKEW DEFENSE ---', async (t) => {
  await t.test('replay detector accepts fresh nonce and rejects replayed nonce', () => {
    const detector = new ReplayDetector(60000);
    const nonce = crypto.randomUUID();
    const now = Date.now();

    const first = detector.validate(nonce, now);
    assert.equal(first.valid, true);

    // Immediate replay must be blocked
    const replay = detector.validate(nonce, now);
    assert.equal(replay.valid, false);
    assert.match(replay.reason ?? '', /Replay attack detected/);

    detector.destroy();
  });

  await t.test('rejects commands with excessive clock skew (> 120s)', () => {
    const detector = new ReplayDetector(60000);
    const nonce = crypto.randomUUID();
    const skewedPast = Date.now() - 150 * 1000; // 150 seconds in the past

    const check = detector.validate(nonce, skewedPast, 120);
    assert.equal(check.valid, false);
    assert.match(check.reason ?? '', /Timestamp drift/);

    detector.destroy();
  });
});

test('--- RATE LIMITING ENGINE ---', async (t) => {
  await t.test('sliding window rate limiter enforces maximum threshold', () => {
    const limiter = new SlidingWindowRateLimiter(10000, 3); // 3 requests per 10s
    const key = 'test-ip-1';

    assert.equal(limiter.check(key).success, true);
    assert.equal(limiter.check(key).success, true);
    assert.equal(limiter.check(key).success, true);

    // 4th request must fail
    const blocked = limiter.check(key);
    assert.equal(blocked.success, false);
    assert.equal(blocked.remaining, 0);

    limiter.destroy();
  });
});
