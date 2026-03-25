import { Request, Response } from 'express';
import * as dashboardService from './dashboard.service';
import { sendSuccess, sendError } from '../../utils/response';
import { prisma } from '../../config/database';

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

export async function getPublicStats(_req: Request, res: Response): Promise<void> {
  try {
    const [totalCompanies, totalUsers, totalProjects, totalTasks, completedTasks, reportsGenerated] =
      await Promise.all([
        prisma.company.count(),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.project.count(),
        prisma.task.count(),
        prisma.task.count({ where: { status: 'COMPLETED' } }),
        prisma.report.count(),
      ]);

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const avgTasksPerProject = totalProjects > 0 ? Math.round(totalTasks / totalProjects) : 0;

    res.json({
      success: true,
      data: {
        totalCompanies,
        totalUsers,
        totalProjects,
        totalTasks,
        completedTasks,
        reportsGenerated,
        completionRate,
        avgTasksPerProject,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    res.status(500).json({ success: false, message: e.message ?? 'Failed to fetch stats' });
  }
}
