import { Request, Response } from 'express';
import * as notificationsService from './notifications.service';
import { sendSuccess, sendError } from '../../utils/response';

export async function listNotifications(req: Request, res: Response): Promise<void> {
  try {
    const page = String(req.query.page ?? '1');
    const limit = String(req.query.limit ?? '20');
    const result = await notificationsService.listNotifications(req.user!.userId, parseInt(page, 10), parseInt(limit, 10));
    sendSuccess(res, result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function markRead(req: Request, res: Response): Promise<void> {
  try {
    const result = await notificationsService.markRead(req.params['id'] as string, req.user!.userId);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  try {
    const result = await notificationsService.markAllRead(req.user!.userId);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}
