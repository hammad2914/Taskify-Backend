import { Request, Response } from 'express';
import * as aiReportService from '../../services/aiReport.service';
import { prisma } from '../../config/database';
import { sendSuccess, sendError } from '../../utils/response';

export async function generateReport(req: Request, res: Response): Promise<void> {
  try {
    const { title, type, projectId } = req.body as { title: string; type: string; projectId?: string };
    const result = await aiReportService.generateReport(projectId, req.user!.companyId, req.user!.userId, type, title);
    sendSuccess(res, result, 201);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed to generate report', e.status ?? 500, e.code);
  }
}

export async function listReports(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query as { projectId?: string };
    const reports = await aiReportService.listReports(req.user!.companyId, projectId);
    sendSuccess(res, reports);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function downloadReport(req: Request, res: Response): Promise<void> {
  try {
    const report = await prisma.report.findFirst({
      where: { id: req.params['id'] as string, companyId: req.user!.companyId },
    });
    if (!report) {
      sendError(res, 'Report not found', 404, 'NOT_FOUND');
      return;
    }

    const reportData = report.data as unknown as import('../../services/aiReport.service').ReportData;

    const pdfBuffer = await aiReportService.generatePdf(reportData, report.title);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.title.replace(/[^a-z0-9]/gi, '_')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed to generate PDF', e.status ?? 500, e.code);
  }
}
