/**
 * Generates an 8-character human-friendly yet cryptographically secure pairing code.
 * Formatted as XXXX-XXXX for ease of reading and input.
 */
export declare function generatePairingCode(): {
    formatted: string;
    raw: string;
};
/**
 * Hashes a pairing code with an optional salt using SHA-256.
 * We normalize the code (uppercase, strip hyphens/whitespace).
 */
export declare function hashPairingCode(code: string, salt?: string): string;
/**
 * Constant-time comparison between two hash strings to prevent timing attacks.
 */
export declare function constantTimeCompare(a: string, b: string): boolean;
/**
 * Generates a privacy-preserving SHA-256 hash of an IP address.
 * Never stores raw IP in audit logs.
 */
export declare function hashIpAddress(ip: string, salt?: string): string;
/**
 * Generates a cryptographically strong challenge nonce.
 */
export declare function generateChallengeNonce(): string;
/**
 * Normalizes PEM string by replacing escaped newlines (e.g. \n or \r\n) with real newlines.
 */
export declare function normalizePem(pem: string): string;
/**
 * Verifies an RSA or ECDSA signature given the public key in PEM format.
 * Signature is expected in Base64 or Hex.
 */
export declare function verifyDeviceSignature(publicKeyPem: string, payloadData: string | Buffer, signature: string, algorithm?: 'RSA-SHA256' | 'SHA256'): boolean;
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
export declare function buildHeartbeatSignaturePayload(hb: HeartbeatSignatureFields): string;
/**
 * Verifies a heartbeat signature against the device's registered public key.
 * Legacy v1 signatures (uuid:timestamp:nonce:locked) are accepted only when the heartbeat carries
 * no location, so agents installed before the location feature keep working until they are updated.
 */
export declare function verifyHeartbeatSignature(publicKeyPem: string, hb: HeartbeatSignatureFields, signature: string): boolean;
/**
 * Signs a payload with an asymmetric private key (used by Agent or server tests).
 */
export declare function signPayload(privateKeyPem: string, payloadData: string | Buffer, algorithm?: 'RSA-SHA256' | 'SHA256'): string;
/**
 * Generates a mock RSA-2048 or RSA-4096 key pair for development/tests.
 */
export declare function generateDeviceKeyPair(modulusLength?: number): {
    publicKey: string;
    privateKey: string;
};
//# sourceMappingURL=crypto.d.ts.map