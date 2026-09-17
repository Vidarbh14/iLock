// ==============================================================================
// iLock Rate Limiting Engine
// Sliding-window counter with automatic cleanup to prevent memory leaks
// ==============================================================================

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

interface WindowRecord {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private records = new Map<string, WindowRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly defaultWindowMs = 60 * 1000,
    private readonly defaultMax = 30
  ) {
    // Periodically clean up stale entries every 2 minutes
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanupStale(), 2 * 60 * 1000);
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  public check(
    key: string,
    windowMs = this.defaultWindowMs,
    maxRequests = this.defaultMax
  ): RateLimitResult {
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

  public reset(key: string): void {
    this.records.delete(key);
  }

  private cleanupStale(): void {
    const now = Date.now();
    this.records.forEach((record, key) => {
      record.timestamps = record.timestamps.filter((ts: number) => ts > now - this.defaultWindowMs);
      if (record.timestamps.length === 0) {
        this.records.delete(key);
      }
    });
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.records.clear();
  }
}

// Global singletons for common rate limit buckets
export const pairingRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 5); // 5 attempts per minute
export const accessCreationRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 15); // 15 creations per minute
export const heartbeatRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 60); // 1 per sec max
export const authRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 10); // 10 auth attempts per minute
