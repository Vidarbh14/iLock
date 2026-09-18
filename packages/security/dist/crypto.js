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