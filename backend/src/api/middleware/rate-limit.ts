import { Request, Response, NextFunction } from 'express';
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, AUTH_RATE_LIMIT_MAX } from '../../config/constants';

/**
 * Simple in-memory sliding-window rate limiter keyed by client IP.
 */
export class RateLimiter {
  private limits = new Map<string, { count: number; resetAt: number }>();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs = RATE_LIMIT_WINDOW_MS, maxRequests = RATE_LIMIT_MAX) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    setInterval(() => this.cleanup(), windowMs).unref?.();
  }

  middleware = (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    let record = this.limits.get(key);
    if (!record || record.resetAt < now) {
      record = { count: 0, resetAt: now + this.windowMs };
      this.limits.set(key, record);
    }
    record.count += 1;
    res.setHeader('X-RateLimit-Limit', this.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - record.count));
    if (record.count > this.maxRequests) {
      res.status(429).json({
        error: 'Zu viele Anfragen. Bitte warten Sie einen Moment.',
        resetAt: new Date(record.resetAt).toISOString(),
      });
      return;
    }
    next();
  };

  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.limits) {
      if (record.resetAt < now) this.limits.delete(key);
    }
  }
}

export const apiLimiter = new RateLimiter(RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX).middleware;
export const authLimiter = new RateLimiter(RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_MAX).middleware;
