import { Request, Response } from 'express';
import * as authService from './auth.service';
import { sendSuccess, sendError } from '../../utils/response';
import { env } from '../../config/env';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.registerCompany(req.body);
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
    sendSuccess(res, { accessToken: result.accessToken, user: result.user, company: result.company }, 201, 'Registration successful');
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Registration failed', e.status ?? 500, e.code);
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
    sendSuccess(res, { accessToken: result.accessToken, user: result.user, company: result.company });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Login failed', e.status ?? 500, e.code);
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const token = req.cookies.refreshToken as string | undefined;
    if (!token) {
      sendError(res, 'No refresh token', 401, 'NO_REFRESH_TOKEN');
      return;
    }
    const result = await authService.refreshAccessToken(token);
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
    sendSuccess(res, { accessToken: result.accessToken });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Refresh failed', e.status ?? 401, e.code);
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie('refreshToken', { path: '/' });
  sendSuccess(res, null, 200, 'Logged out');
}

export async function acceptInvite(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.acceptInvite(req.body);
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
    sendSuccess(res, { accessToken: result.accessToken, user: result.user, company: result.company });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Accept invite failed', e.status ?? 500, e.code);
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.getCurrentUser(req.user!.userId, req.user!.companyId);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed to get user', e.status ?? 500, e.code);
  }
}

export async function resendInvite(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.resendInvite(req.params.id as string, req.user!.companyId);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Resend invite failed', e.status ?? 500, e.code);
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.changePassword(req.user!.userId, req.body);
    sendSuccess(res, result, 200, 'Password changed successfully');
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed to change password', e.status ?? 500, e.code);
  }
}

export async function updateCompanyName(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.updateCompanyName(req.user!.companyId, req.body);
    sendSuccess(res, result, 200, 'Company name updated successfully');
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed to update company name', e.status ?? 500, e.code);
  }
}
