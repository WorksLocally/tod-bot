/**
 * Simple in-memory rate limiter to prevent abuse of submission commands.
 * Uses a sliding window approach to track user actions.
 *
 * @module src/utils/rateLimiter
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Rate limiter using sliding window algorithm for tracking user actions.
 */
export class RateLimiter {
  private limits: Map<string, RateLimitEntry>;
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null;

  /**
   * Creates a new rate limiter instance.
   *
   * @param maxRequests - Maximum number of requests allowed in the time window
   * @param windowMs - Time window in milliseconds
   * @param cleanupIntervalMs - How often to clean up expired entries (default: 5 minutes)
   */
  constructor(maxRequests: number, windowMs: number, cleanupIntervalMs: number = 5 * 60 * 1000) {
    this.limits = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    
    // Periodically clean up expired entries to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
    
    // Allow cleanup interval to be cleared on process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Checks if a user has exceeded their rate limit.
   *
   * @param userId - Discord user ID to check
   * @returns True if the user is rate limited, false otherwise
   */
  isRateLimited(userId: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(userId);

    if (!entry) {
      // First request from this user
      this.limits.set(userId, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return false;
    }

    // Check if the window has expired
    if (now >= entry.resetAt) {
      // Reset the counter
      entry.count = 1;
      entry.resetAt = now + this.windowMs;
      return false;
    }

    // Check if limit would be exceeded by this request
    if (entry.count >= this.maxRequests) {
      return true;
    }

    // Increment the counter (request is allowed)
    entry.count += 1;
    return false;
  }

  /**
   * Gets the remaining time until the rate limit resets for a user.
   *
   * @param userId - Discord user ID to check
   * @returns Milliseconds until reset, or 0 if not rate limited
   */
  getTimeUntilReset(userId: string): number {
    const entry = this.limits.get(userId);
    if (!entry) {
      return 0;
    }

    const now = Date.now();
    if (now >= entry.resetAt) {
      return 0;
    }

    return entry.resetAt - now;
  }

  /**
   * Manually resets the rate limit for a specific user.
   * Useful for administrative purposes.
   *
   * @param userId - Discord user ID to reset
   */
  reset(userId: string): void {
    this.limits.delete(userId);
  }

  /**
   * Cleans up expired entries to prevent memory leaks.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [userId, entry] of this.limits.entries()) {
      if (now >= entry.resetAt) {
        this.limits.delete(userId);
      }
    }
  }

  /**
   * Clears the cleanup interval. Should be called on shutdown.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.limits.clear();
  }

  /**
   * Gets current statistics about the rate limiter.
   *
   * @returns Object containing statistics
   */
  getStats(): { totalTracked: number; rateLimited: number } {
    const now = Date.now();
    let rateLimited = 0;

    for (const entry of this.limits.values()) {
      if (entry.count > this.maxRequests && now < entry.resetAt) {
        rateLimited += 1;
      }
    }

    return {
      totalTracked: this.limits.size,
      rateLimited,
    };
  }
}

// Global rate limiter instances for different command types
// Submission rate limit: 5 submissions per 10 minutes per user
export const submissionRateLimiter = new RateLimiter(5, 10 * 60 * 1000);

// Question command rate limit: 20 commands per minute per user (prevents spam of /truth, /dare)
export const questionRateLimiter = new RateLimiter(20, 60 * 1000);
