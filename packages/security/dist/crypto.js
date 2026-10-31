"use strict";
// ==============================================================================
// iLock Security & Cryptographic Core
// Asymmetric verification, constant-time comparisons, token generation
// ==============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePairingCode = generatePairingCode;
exports.hashPairingCode = hashPairingCode;
exports.constantTimeCompare = constantTimeCompare;
exports.hashIpAddress = hashIpAddress;
exports.generateChallengeNonce = generateChallengeNonce;
exports.normalizePem = normalizePem;
exports.verifyDeviceSignature = verifyDeviceSignature;
exports.buildHeartbeatSignaturePayload = buildHeartbeatSignaturePayload;
exports.verifyHeartbeatSignature = verifyHeartbeatSignature;
exports.signPayload = signPayload;
exports.generateDeviceKeyPair = generateDeviceKeyPair;
const node_crypto_1 = __importDefault(require("node:crypto"));
// Character alphabet for pairing codes (excluding easily confused 0, O, 1, I)
const PAIRING_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
/**
 * Generates an 8-character human-friendly yet cryptographically secure pairing code.
 * Formatted as XXXX-XXXX for ease of reading and input.
 */
function generatePairingCode() {
    const bytes = node_crypto_1.default.randomBytes(8);
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
function hashPairingCode(code, salt = '') {
    const normalized = code.replace(/[\s-]/g, '').toUpperCase();
    return node_crypto_1.default.createHash('sha256').update(`${salt}:${normalized}`).digest('hex');
}
/**
 * Constant-time comparison between two hash strings to prevent timing attacks.
 */
function constantTimeCompare(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    return node_crypto_1.default.timingSafeEqual(bufA, bufB);
}
/**
 * Generates a privacy-preserving SHA-256 hash of an IP address.
 * Never stores raw IP in audit logs.
 */
function hashIpAddress(ip, salt = 'ilock-privacy-salt') {
    if (!ip || ip === 'unknown')
        return '0000000000000000';
    return node_crypto_1.default.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 16);
}
/**
 * Generates a cryptographically strong challenge nonce.
 */
function generateChallengeNonce() {
    return node_crypto_1.default.randomBytes(32).toString('hex');
}
/**
 * Normalizes PEM string by replacing escaped newlines (e.g. \n or \r\n) with real newlines.
 */
function normalizePem(pem) {
    if (!pem)
        return pem;
    return pem.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
}
/**
 * Verifies an RSA or ECDSA signature given the public key in PEM format.
 * Signature is expected in Base64 or Hex.
 */
function verifyDeviceSignature(publicKeyPem, payloadData, signature, algorithm = 'RSA-SHA256') {
    try {
        const cleanPem = normalizePem(publicKeyPem);
        const verifier = node_crypto_1.default.createVerify(algorithm);
        verifier.update(payloadData);
        verifier.end();
        const sigEncoding = /^[0-9a-fA-F]+$/.test(signature) ? 'hex' : 'base64';
        return verifier.verify(cleanPem, signature, sigEncoding);
    }
    catch (err) {
        // If key format or signature is malformed, fail safely
        return false;
    }
}
/**
 * Canonical string an agent signs for every heartbeat (v2).
 * Covers lock state and the location fix so neither can be forged or altered.
 * Agents send coordinates pre-rounded to 6 decimals and accuracy to whole metres, and numbers
 * are rendered with fixed decimals, so C# (InvariantCulture "F6") and JS (toFixed) agree byte-for-byte.
 */
function buildHeartbeatSignaturePayload(hb) {
    const fixed = (v, digits) => (typeof v === 'number' ? v.toFixed(digits) : '');
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
function verifyHeartbeatSignature(publicKeyPem, hb, signature) {
    if (verifyDeviceSignature(publicKeyPem, buildHeartbeatSignaturePayload(hb), signature)) {
        return true;
    }
    const hasLocation = [hb.latitude, hb.longitude, hb.locationAccuracyM, hb.locationFixedAt].some((v) => v !== null && v !== undefined);
    if (hasLocation) {
        return false;
    }
    // C# agent renders booleans as True/False; the JS simulator as true/false
    const lockedVariants = hb.workstationLocked ? ['True', 'true'] : ['False', 'false'];
    return lockedVariants.some((locked) => verifyDeviceSignature(publicKeyPem, `${hb.deviceUuid}:${hb.timestamp}:${hb.nonce}:${locked}`, signature));
}
/**
 * Signs a payload with an asymmetric private key (used by Agent or server tests).
 */
function signPayload(privateKeyPem, payloadData, algorithm = 'RSA-SHA256') {
    const signer = node_crypto_1.default.createSign(algorithm);
    signer.update(payloadData);
    signer.end();
    return signer.sign(privateKeyPem, 'base64');
}
/**
 * Generates a mock RSA-2048 or RSA-4096 key pair for development/tests.
 */
function generateDeviceKeyPair(modulusLength = 2048) {
    return node_crypto_1.default.generateKeyPairSync('rsa', {
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
//# sourceMappingURL=crypto.js.map