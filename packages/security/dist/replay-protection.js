"use strict";
// ==============================================================================
// iLock Replay Protection & Timestamp Verification
// Prevents man-in-the-middle replay attacks and clock tampering
// ==============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalReplayDetector = exports.ReplayDetector = exports.MAX_CLOCK_DRIFT_SECONDS = void 0;
exports.MAX_CLOCK_DRIFT_SECONDS = 120; // 2 minutes
class ReplayDetector {
    ttlMs;
    seenNonces = new Map();
    cleanupInterval = null;
    constructor(ttlMs = 5 * 60 * 1000) {
        this.ttlMs = ttlMs;
        // Stored nonces expire after 5 minutes
        if (typeof setInterval !== 'undefined') {
            this.cleanupInterval = setInterval(() => this.cleanup(), this.ttlMs);
            if (this.cleanupInterval.unref) {
                this.cleanupInterval.unref();
            }
        }
    }
    /**
     * Validates whether a command's timestamp is within acceptable drift window
     * and verifies that the nonce has not been previously observed.
     *
     * @param nonce Cryptographic nonce from request
     * @param timestampMs Epoch timestamp in milliseconds
     * @param maxDriftSeconds Maximum tolerated clock skew (defaults to 120s)
     */
    validate(nonce, timestampMs, maxDriftSeconds = exports.MAX_CLOCK_DRIFT_SECONDS) {
        const now = Date.now();
        const driftSeconds = Math.abs(now - timestampMs) / 1000;
        if (driftSeconds > maxDriftSeconds) {
            return {
                valid: false,
                reason: `Timestamp drift of ${driftSeconds.toFixed(1)}s exceeds limit of ${maxDriftSeconds}s`,
            };
        }
        if (this.seenNonces.has(nonce)) {
            return {
                valid: false,
                reason: `Replay attack detected: Nonce '${nonce}' has already been processed`,
            };
        }
        // Register nonce
        this.seenNonces.set(nonce, now);
        return { valid: true };
    }
    cleanup() {
        const now = Date.now();
        this.seenNonces.forEach((ts, nonce) => {
            if (now - ts > this.ttlMs) {
                this.seenNonces.delete(nonce);
            }
        });
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.seenNonces.clear();
    }
}
exports.ReplayDetector = ReplayDetector;
exports.globalReplayDetector = new ReplayDetector();
//# sourceMappingURL=replay-protection.js.map