import { Request, Response } from 'express';
import * as dashboardService from './dashboard.service';
import { sendSuccess, sendError } from '../../utils/response';

export async function getCompanyStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await dashboardService.getCompanyStats(req.user!.companyId);
    sendSuccess(res, stats);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function getProjectStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await dashboardService.getProjectStats(req.params['id'] as string, req.user!.companyId);
    sendSuccess(res, stats);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function getMyTasks(req: Request, res: Response): Promise<void> {
  try {
    const result = await dashboardService.getMyTasks(req.user!.userId, req.user!.companyId);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function getActivityFeed(req: Request, res: Response): Promise<void> {
  try {
    const feed = await dashboardService.getActivityFeed(req.user!.companyId);
    sendSuccess(res, feed);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}
