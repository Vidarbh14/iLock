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
    const verifier = crypto.createVerify(algorithm);
    verifier.update(payloadData);
    verifier.end();

    const sigEncoding = /^[0-9a-fA-F]+$/.test(signature) ? 'hex' : 'base64';
    return verifier.verify(publicKeyPem, signature, sigEncoding);
  } catch (err) {
    // If key format or signature is malformed, fail safely
    return false;
  }
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
