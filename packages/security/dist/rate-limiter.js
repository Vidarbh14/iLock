"use strict";
// ==============================================================================
// iLock Rate Limiting Engine
// Sliding-window counter with automatic cleanup to prevent memory leaks
// ==============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimiter = exports.heartbeatRateLimiter = exports.accessCreationRateLimiter = exports.pairingRateLimiter = exports.SlidingWindowRateLimiter = void 0;
class SlidingWindowRateLimiter {
    defaultWindowMs;
    defaultMax;
    records = new Map();
    cleanupInterval = null;
    constructor(defaultWindowMs = 60 * 1000, defaultMax = 30) {
        this.defaultWindowMs = defaultWindowMs;
        this.defaultMax = defaultMax;
        // Periodically clean up stale entries every 2 minutes
        if (typeof setInterval !== 'undefined') {
            this.cleanupInterval = setInterval(() => this.cleanupStale(), 2 * 60 * 1000);
            if (this.cleanupInterval.unref) {
                this.cleanupInterval.unref();
            }
        }
    }
    check(key, windowMs = this.defaultWindowMs, maxRequests = this.defaultMax) {
        const now = Date.now();
        const windowStart = now - windowMs;
        let record = this.records.get(key);
        if (!record) {
            record = { timestamps: [] };
            this.records.set(key, record);
        }
        // Filter out timestamps outside the active window
        record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
        if (record.timestamps.length >= maxRequests) {
            const oldestInWindow = record.timestamps[0] ?? now;
            const resetTimeMs = oldestInWindow + windowMs;
            return {
                success: false,
                limit: maxRequests,
                remaining: 0,
                resetTimeMs,
            };
        }
        record.timestamps.push(now);
        const resetTimeMs = now + windowMs;
        return {
            success: true,
            limit: maxRequests,
            remaining: maxRequests - record.timestamps.length,
            resetTimeMs,
        };
    }
    reset(key) {
        this.records.delete(key);
    }
    cleanupStale() {
        const now = Date.now();
        this.records.forEach((record, key) => {
            record.timestamps = record.timestamps.filter((ts) => ts > now - this.defaultWindowMs);
            if (record.timestamps.length === 0) {
                this.records.delete(key);
            }
        });
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.records.clear();
    }
}
exports.SlidingWindowRateLimiter = SlidingWindowRateLimiter;
// Global singletons for common rate limit buckets
exports.pairingRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 5); // 5 attempts per minute
exports.accessCreationRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 15); // 15 creations per minute
exports.heartbeatRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 60); // 1 per sec max
exports.authRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 10); // 10 auth attempts per minute
//# sourceMappingURL=rate-limiter.js.map