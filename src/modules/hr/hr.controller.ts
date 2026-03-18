import { Request, Response } from 'express';
import * as hrService from './hr.service';
import { sendSuccess, sendError } from '../../utils/response';

export async function testConnection(req: Request, res: Response): Promise<void> {
  try {
    const result = await hrService.testConnection(req.body.hrApiUrl as string);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Connection test failed', e.status ?? 500, e.code);
  }
}

export async function syncEmployees(req: Request, res: Response): Promise<void> {
  try {
    const company = await import('../../config/database').then(m =>
      m.prisma.company.findUnique({ where: { id: req.user!.companyId } })
    );
    const hrApiUrl = (req.body.hrApiUrl as string | undefined) ?? company?.hrApiUrl;
    if (!hrApiUrl) {
      sendError(res, 'No HR API URL configured', 400, 'NO_HR_URL');
      return;
    }
    const result = await hrService.syncEmployees(req.user!.companyId, hrApiUrl);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Sync failed', e.status ?? 500, e.code);
  }
}

export async function getStatus(req: Request, res: Response): Promise<void> {
  try {
    const status = await hrService.getHrStatus(req.user!.companyId);
    sendSuccess(res, status);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed to get HR status', e.status ?? 500, e.code);
  }
}
