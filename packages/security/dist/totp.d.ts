export declare function base32Encode(buffer: Buffer): string;
export declare function base32Decode(base32: string): Buffer;
/**
 * Derives a deterministic 20-byte TOTP secret for a device from its UUID and an optional salt.
 */
export declare function deriveDeviceTotpSecret(deviceUuid: string, salt?: string): string;
/**
 * Generates a 6-digit TOTP code for the given secret and time.
 * @param secret Base32-encoded secret
 * @param timeMs Epoch milliseconds (defaults to Date.now())
 * @param timeStepSeconds Default 30s
 */
export declare function generateTotpCode(secret: string, timeMs?: number, timeStepSeconds?: number): {
    code: string;
    secondsRemaining: number;
};
/**
 * Validates a TOTP code against a secret within a time drift window (default +/- 1 step).
 */
export declare function verifyTotpCode(code: string, secret: string, timeMs?: number, windowSteps?: number, timeStepSeconds?: number): boolean;
//# sourceMappingURL=totp.d.ts.map