"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.base32Encode = base32Encode;
exports.base32Decode = base32Decode;
exports.deriveDeviceTotpSecret = deriveDeviceTotpSecret;
exports.generateTotpCode = generateTotpCode;
exports.verifyTotpCode = verifyTotpCode;
const node_crypto_1 = __importDefault(require("node:crypto"));
/**
 * RFC 6238 Time-Based One-Time Password (TOTP) Implementation
 * Provides offline zero-internet authorization between iPhone/Web and Windows PC.
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let output = '';
    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
}
function base32Decode(base32) {
    const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (let i = 0; i < clean.length; i++) {
        const idx = BASE32_ALPHABET.indexOf(clean[i]);
        if (idx === -1)
            continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}
/**
 * Derives a deterministic 20-byte TOTP secret for a device from its UUID and an optional salt.
 */
function deriveDeviceTotpSecret(deviceUuid, salt = 'ilock-totp-v1') {
    const hash = node_crypto_1.default.createHmac('sha256', salt).update(deviceUuid).digest();
    return base32Encode(hash.subarray(0, 20));
}
/**
 * Generates a 6-digit TOTP code for the given secret and time.
 * @param secret Base32-encoded secret
 * @param timeMs Epoch milliseconds (defaults to Date.now())
 * @param timeStepSeconds Default 30s
 */
function generateTotpCode(secret, timeMs = Date.now(), timeStepSeconds = 30) {
    const key = base32Decode(secret);
    const timeStep = Math.floor(timeMs / 1000 / timeStepSeconds);
    const secondsRemaining = timeStepSeconds - (Math.floor(timeMs / 1000) % timeStepSeconds);
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(BigInt(timeStep), 0);
    const hmac = node_crypto_1.default.createHmac('sha1', key).update(timeBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    const otp = binary % 1000000;
    const code = otp.toString().padStart(6, '0');
    return { code, secondsRemaining };
}
/**
 * Validates a TOTP code against a secret within a time drift window (default +/- 1 step).
 */
function verifyTotpCode(code, secret, timeMs = Date.now(), windowSteps = 1, timeStepSeconds = 30) {
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
        return false;
    }
    const cleanCode = code.trim();
    for (let offset = -windowSteps; offset <= windowSteps; offset++) {
        const checkTime = timeMs + offset * timeStepSeconds * 1000;
        const { code: expectedCode } = generateTotpCode(secret, checkTime, timeStepSeconds);
        if (node_crypto_1.default.timingSafeEqual(Buffer.from(cleanCode), Buffer.from(expectedCode))) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=totp.js.map