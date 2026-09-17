export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}
export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    resetTimeMs: number;
}
export declare class SlidingWindowRateLimiter {
    private readonly defaultWindowMs;
    private readonly defaultMax;
    private records;
    private cleanupInterval;
    constructor(defaultWindowMs?: number, defaultMax?: number);
    check(key: string, windowMs?: number, maxRequests?: number): RateLimitResult;
    reset(key: string): void;
    private cleanupStale;
    destroy(): void;
}
export declare const pairingRateLimiter: SlidingWindowRateLimiter;
export declare const accessCreationRateLimiter: SlidingWindowRateLimiter;
export declare const heartbeatRateLimiter: SlidingWindowRateLimiter;
export declare const authRateLimiter: SlidingWindowRateLimiter;
//# sourceMappingURL=rate-limiter.d.ts.map