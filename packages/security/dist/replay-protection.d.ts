export declare const MAX_CLOCK_DRIFT_SECONDS = 120;
export declare class ReplayDetector {
    private readonly ttlMs;
    private seenNonces;
    private cleanupInterval;
    constructor(ttlMs?: number);
    /**
     * Validates whether a command's timestamp is within acceptable drift window
     * and verifies that the nonce has not been previously observed.
     *
     * @param nonce Cryptographic nonce from request
     * @param timestampMs Epoch timestamp in milliseconds
     * @param maxDriftSeconds Maximum tolerated clock skew (defaults to 120s)
     */
    validate(nonce: string, timestampMs: number, maxDriftSeconds?: number): {
        valid: boolean;
        reason?: string;
    };
    private cleanup;
    destroy(): void;
}
export declare const globalReplayDetector: ReplayDetector;
//# sourceMappingURL=replay-protection.d.ts.map