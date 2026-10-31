// ==============================================================================
// iLock Security & Cryptographic Core
// Asymmetric verification, constant-time comparisons, token generation
// ==============================================================================

import crypto from 'node:crypto';

// Character alphabet for pairing codes (excluding easily confused 0, O, 1, I)
const PAIRING_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates an 8-character human-friendly yet cryptographically secure pairing code.
 * Formatted as XXXX-XXXX for ease of reading and input.
 */
export function generatePairingCode(): { formatted: string; raw: string } {
  const bytes = crypto.randomBytes(8);
  let raw = '';
  for (let i = 0; i < 8; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      raw += PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length];
    }
  }
  const formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
  return { formatted, raw };
}

/**
 * Hashes a pairing code with an optional salt using SHA-256.
 * We normalize the code (uppercase, strip hyphens/whitespace).
 */
export function hashPairingCode(code: string, salt = ''): string {
  const normalized = code.replace(/[\s-]/g, '').toUpperCase();
  return crypto.createHash('sha256').update(`${salt}:${normalized}`).digest('hex');
}

/**
 * Constant-time comparison between two hash strings to prevent timing attacks.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generates a privacy-preserving SHA-256 hash of an IP address.
 * Never stores raw IP in audit logs.
 */
export function hashIpAddress(ip: string, salt = 'ilock-privacy-salt'): string {
  if (!ip || ip === 'unknown') return '0000000000000000';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 16);
}

/**
 * Generates a cryptographically strong challenge nonce.
 */
export function generateChallengeNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Normalizes PEM string by replacing escaped newlines (e.g. \n or \r\n) with real newlines.
 */
export function normalizePem(pem: string): string {
  if (!pem) return pem;
  return pem.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
}

/**
 * Verifies an RSA or ECDSA signature given the public key in PEM format.
 * Signature is expected in Base64 or Hex.
 */
export function verifyDeviceSignature(
  publicKeyPem: string,
  payloadData: string | Buffer,
  signature: string,
  algorithm: 'RSA-SHA256' | 'SHA256' = 'RSA-SHA256'
): boolean {
  try {
    const cleanPem = normalizePem(publicKeyPem);
    const verifier = crypto.createVerify(algorithm);
    verifier.update(payloadData);
    verifier.end();

    const sigEncoding = /^[0-9a-fA-F]+$/.test(signature) ? 'hex' : 'base64';
    return verifier.verify(cleanPem, signature, sigEncoding);
  } catch (err) {
    // If key format or signature is malformed, fail safely
    return false;
  }
}

export interface HeartbeatSignatureFields {
  deviceUuid: string;
  timestamp: number;
  nonce: string;
  workstationLocked: boolean;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyM?: number | null;
  locationFixedAt?: number | null;
}

/**
 * Canonical string an agent signs for every heartbeat (v2).
 * Covers lock state and the location fix so neither can be forged or altered.
 * Agents send coordinates pre-rounded to 6 decimals and accuracy to whole metres, and numbers
 * are rendered with fixed decimals, so C# (InvariantCulture "F6") and JS (toFixed) agree byte-for-byte.
 */
export function buildHeartbeatSignaturePayload(hb: HeartbeatSignatureFields): string {
  const fixed = (v: number | null | undefined, digits: number) => (typeof v === 'number' ? v.toFixed(digits) : '');
  return [
    'v2',
    hb.deviceUuid,
    hb.timestamp,
    hb.nonce,
    hb.workstationLocked ? 'true' : 'false',
    fixed(hb.latitude, 6),
    fixed(hb.longitude, 6),
    fixed(hb.locationAccuracyM, 0),
    hb.locationFixedAt ?? '',
  ].join(':');
}

/**
 * Verifies a heartbeat signature against the device's registered public key.
 * Legacy v1 signatures (uuid:timestamp:nonce:locked) are accepted only when the heartbeat carries
 * no location, so agents installed before the location feature keep working until they are updated.
 */
export function verifyHeartbeatSignature(publicKeyPem: string, hb: HeartbeatSignatureFields, signature: string): boolean {
  if (verifyDeviceSignature(publicKeyPem, buildHeartbeatSignaturePayload(hb), signature)) {
    return true;
  }

  const hasLocation = [hb.latitude, hb.longitude, hb.locationAccuracyM, hb.locationFixedAt].some(
    (v) => v !== null && v !== undefined
  );
  if (hasLocation) {
    return false;
  }

  // C# agent renders booleans as True/False; the JS simulator as true/false
  const lockedVariants = hb.workstationLocked ? ['True', 'true'] : ['False', 'false'];
  return lockedVariants.some((locked) =>
    verifyDeviceSignature(publicKeyPem, `${hb.deviceUuid}:${hb.timestamp}:${hb.nonce}:${locked}`, signature)
  );
}

/**
 * Signs a payload with an asymmetric private key (used by Agent or server tests).
 */
export function signPayload(
  privateKeyPem: string,
  payloadData: string | Buffer,
  algorithm: 'RSA-SHA256' | 'SHA256' = 'RSA-SHA256'
): string {
  const signer = crypto.createSign(algorithm);
  signer.update(payloadData);
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
}

/**
 * Generates a mock RSA-2048 or RSA-4096 key pair for development/tests.
 */
export function generateDeviceKeyPair(modulusLength = 2048): {
  publicKey: string;
  privateKey: string;
} {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });
}
