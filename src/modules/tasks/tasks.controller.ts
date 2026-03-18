import { Request, Response } from 'express';
import * as tasksService from './tasks.service';
import { sendSuccess, sendError } from '../../utils/response';

export async function listProjectTasks(req: Request, res: Response): Promise<void> {
  try {
    const tasks = await tasksService.listProjectTasks(req.params['id'] as string, req.user!.companyId);
    sendSuccess(res, tasks);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function getTaskById(req: Request, res: Response): Promise<void> {
  try {
    const task = await tasksService.getTaskById(req.params['id'] as string, req.user!.companyId);
    sendSuccess(res, task);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Not found', e.status ?? 500, e.code);
  }
}

export async function createTask(req: Request, res: Response): Promise<void> {
  try {
    const task = await tasksService.createTask(req.params['id'] as string, req.user!.companyId, req.body, req.user!.userId);
    sendSuccess(res, task, 201);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  try {
    const task = await tasksService.updateTask(req.params['id'] as string, req.user!.companyId, req.body, req.user!.userId);
    sendSuccess(res, task);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function updateTaskStatus(req: Request, res: Response): Promise<void> {
  try {
    const task = await tasksService.updateTaskStatus(req.params['id'] as string, req.user!.companyId, req.body.status as 'IN_PROGRESS' | 'COMPLETED', req.user!.userId);
    sendSuccess(res, task);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function acceptTimeline(req: Request, res: Response): Promise<void> {
  try {
    const task = await tasksService.acceptTimeline(req.params['id'] as string, req.user!.companyId, req.user!.userId);
    sendSuccess(res, task);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function requestRevision(req: Request, res: Response): Promise<void> {
  try {
    const result = await tasksService.requestRevision(req.params['id'] as string, req.user!.companyId, req.user!.userId, req.body.comment as string);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function addComment(req: Request, res: Response): Promise<void> {
  try {
    const comment = await tasksService.addComment(req.params['id'] as string, req.user!.companyId, req.user!.userId, req.body);
    sendSuccess(res, comment, 201);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function listComments(req: Request, res: Response): Promise<void> {
  try {
    const comments = await tasksService.listComments(req.params['id'] as string, req.user!.companyId);
    sendSuccess(res, comments);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}
