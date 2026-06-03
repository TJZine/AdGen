/**
 * A simple in-memory Token Bucket rate limiter.
 * This class tracks requests for individual clients (by IP or user ID)
 * and limits them according to bucket capacity and refill rate.
 */
class TokenBucketRateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefilled: number }>();
  private readonly capacity: number;
  private readonly refillRateMs: number; // Time to refill 1 token in ms

  constructor(capacity = 10, refillRateSeconds = 6) {
    this.capacity = capacity;
    this.refillRateMs = refillRateSeconds * 1000;
  }

  private pruneIdleBuckets(now: number): void {
    const idleExpiryMs = this.capacity * this.refillRateMs;

    for (const [clientId, bucket] of this.buckets) {
      const elapsed = now - bucket.lastRefilled;
      const refilledTokens = Math.floor(elapsed / this.refillRateMs);
      const wouldBeFull = bucket.tokens + refilledTokens >= this.capacity;

      if (wouldBeFull && elapsed > idleExpiryMs) {
        this.buckets.delete(clientId);
      }
    }
  }

  /**
   * Attempts to consume one token for the given identifier.
   * Returns true if a token was consumed (allowed), false if rate-limited.
   */
  public consume(clientId: string): boolean {
    const now = Date.now();
    this.pruneIdleBuckets(now);

    let bucket = this.buckets.get(clientId);

    if (!bucket) {
      // First request, initialize bucket with capacity - 1
      bucket = { tokens: this.capacity - 1, lastRefilled: now };
      this.buckets.set(clientId, bucket);
      return true;
    }

    // Calculate how many tokens should be added based on elapsed time
    const elapsed = now - bucket.lastRefilled;
    const tokensToAdd = Math.floor(elapsed / this.refillRateMs);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefilled = bucket.lastRefilled + tokensToAdd * this.refillRateMs;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(clientId, bucket);
      return true;
    }

    return false;
  }
}

// Export a singleton instance for API routes. 
// Standard: capacity of 10, 1 token refilled every 6 seconds (10 requests per minute average, max burst 10).
export const uploadRateLimiter = new TokenBucketRateLimiter(10, 6);
