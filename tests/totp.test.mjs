import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  deriveDeviceTotpSecret,
  generateTotpCode,
  verifyTotpCode,
} = require('../packages/security/dist/index.js');

test('--- RFC 6238 TOTP OFFLINE AUTHENTICATOR ---', async (t) => {
  await t.test('derives deterministic Base32 secret for device UUID', () => {
    const secret1 = deriveDeviceTotpSecret('a3059898-aacf-4538-80eb-08caf1375cba');
    const secret2 = deriveDeviceTotpSecret('a3059898-aacf-4538-80eb-08caf1375cba');
    assert.equal(secret1, secret2);
    assert.match(secret1, /^[A-Z2-7]{32}$/);
  });

  await t.test('generates valid 6-digit numeric OTP code', () => {
    const secret = deriveDeviceTotpSecret('test-device-uuid');
    const { code, secondsRemaining } = generateTotpCode(secret);
    assert.match(code, /^\d{6}$/);
    assert.ok(secondsRemaining >= 0 && secondsRemaining <= 30);
  });

  await t.test('verifies matching TOTP code within time window', () => {
    const secret = deriveDeviceTotpSecret('test-device-uuid');
    const now = Date.now();
    const { code } = generateTotpCode(secret, now);
    assert.equal(verifyTotpCode(code, secret, now), true);
  });

  await t.test('rejects incorrect or forged code', () => {
    const secret = deriveDeviceTotpSecret('test-device-uuid');
    assert.equal(verifyTotpCode('000000', secret), false);
    assert.equal(verifyTotpCode('123456', secret), false);
    assert.equal(verifyTotpCode('invalid', secret), false);
  });

  await t.test('tolerates +/- 1 time step drift window', () => {
    const secret = deriveDeviceTotpSecret('test-device-uuid');
    const pastTime = Date.now() - 25000; // 25s ago
    const { code } = generateTotpCode(secret, pastTime);
    assert.equal(verifyTotpCode(code, secret, Date.now(), 1), true);
  });
});
