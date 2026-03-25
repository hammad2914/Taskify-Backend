import { Request, Response } from 'express';
import { resetDemo, loginDemoAdmin } from './demo.service';
import { sendSuccess, sendError } from '../../utils/response';
import { env } from '../../config/env';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

export async function reset(req: Request, res: Response): Promise<void> {
  try {
    const credentials = await resetDemo();
    sendSuccess(res, { credentials, message: 'Demo reset successfully' });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    console.error('[DEMO] Reset failed:', err);
    sendError(res, e.message ?? 'Demo reset failed', e.status ?? 500, e.code);
  }
}

export async function demoLogin(_req: Request, res: Response): Promise<void> {
  try {
    const { accessToken, refreshToken, user, company } = await loginDemoAdmin();
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    sendSuccess(res, { accessToken, user, company });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    console.error('[DEMO] Login failed:', err);
    sendError(res, e.message ?? 'Demo login failed', e.status ?? 500, e.code);
  }
}
