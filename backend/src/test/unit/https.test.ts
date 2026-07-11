import { requireHttps } from '../../api/middleware/https';
import { config } from '../../config/config';
import type { Request, Response } from 'express';

const cfg = config as { isProduction: boolean };

function mockReq(opts: { path?: string; secure?: boolean; xfp?: string }): Request {
  return {
    path: opts.path ?? '/api/mail',
    secure: opts.secure ?? false,
    headers: opts.xfp ? { 'x-forwarded-proto': opts.xfp } : {},
  } as unknown as Request;
}

function mockRes(): Response {
  const res = {
    status() {
      return res;
    },
    json() {
      return res;
    },
  } as unknown as Response;
  return res;
}

describe('requireHttps middleware', () => {
  const orig = config.isProduction;
  afterAll(() => {
    cfg.isProduction = orig;
  });

  it('passes through in development regardless of protocol', () => {
    cfg.isProduction = false;
    const next = jest.fn();
    requireHttps(mockReq({ secure: false }), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects plaintext requests with 403 in production', () => {
    cfg.isProduction = true;
    const next = jest.fn();
    const state = { code: 0, body: null as unknown };
    const res = {
      status(c: number) {
        state.code = c;
        return this;
      },
      json(b: unknown) {
        state.body = b;
        return this;
      },
    } as unknown as Response;
    requireHttps(mockReq({ secure: false }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(state.code).toBe(403);
  });

  it('allows requests with X-Forwarded-Proto=https in production', () => {
    cfg.isProduction = true;
    const next = jest.fn();
    const res = { status: () => res, json: () => res } as unknown as Response;
    requireHttps(mockReq({ secure: false, xfp: 'https' }), res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows req.secure=true in production', () => {
    cfg.isProduction = true;
    const next = jest.fn();
    const res = { status: () => res, json: () => res } as unknown as Response;
    requireHttps(mockReq({ secure: true }), res, next);
    expect(next).toHaveBeenCalled();
  });

  it('exempts the /health probe from HTTPS enforcement', () => {
    cfg.isProduction = true;
    const next = jest.fn();
    const res = { status: () => res, json: () => res } as unknown as Response;
    requireHttps(mockReq({ path: '/health', secure: false }), res, next);
    expect(next).toHaveBeenCalled();
  });
});
