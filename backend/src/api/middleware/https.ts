import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/config';

/**
 * Second line of defence behind the TLS-terminating reverse proxy.
 *
 * In production every request must arrive over HTTPS. Because TLS is
 * terminated at nginx, we trust the X-Forwarded-Proto header (Express sets
 * req.secure accordingly once `trust proxy` is enabled). A request that is not
 * secure is rejected outright so nobody can bypass the proxy and talk to the
 * backend in plaintext on the internal network.
 *
 * The health check is exempt so container/orchestrator probes work over plain
 * HTTP inside the network.
 */
export function requireHttps(req: Request, res: Response, next: NextFunction): void {
  if (!config.isProduction) {
    next();
    return;
  }
  if (req.path === '/health') {
    next();
    return;
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const isSecure = req.secure || proto === 'https';
  if (isSecure) {
    next();
    return;
  }
  res.status(403).json({ error: 'HTTPS required' });
}
