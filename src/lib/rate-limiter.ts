export class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter(
      (t) => now - t < this.windowMs
    );

    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(now);
      return;
    }

    // Wait until the oldest request falls outside the window
    const oldestInWindow = this.timestamps[0];
    const waitMs = oldestInWindow + this.windowMs - now + 50; // +50ms buffer

    await new Promise((resolve) => setTimeout(resolve, waitMs));

    // Clean up and add our timestamp
    this.timestamps = this.timestamps.filter(
      (t) => Date.now() - t < this.windowMs
    );
    this.timestamps.push(Date.now());
  }
}
