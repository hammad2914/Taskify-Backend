import { Request, Response } from 'express';
import * as projectsService from './projects.service';
import { sendSuccess, sendError } from '../../utils/response';

export async function listProjects(req: Request, res: Response): Promise<void> {
  try {
    const projects = await projectsService.listProjects(req.user!.companyId, req.user!.userId, req.user!.role);
    sendSuccess(res, projects);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function getProjectById(req: Request, res: Response): Promise<void> {
  try {
    const project = await projectsService.getProjectById(req.params['id'] as string, req.user!.companyId);
    sendSuccess(res, project);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Not found', e.status ?? 500, e.code);
  }
}

export async function createProject(req: Request, res: Response): Promise<void> {
  try {
    const project = await projectsService.createProject(req.body, req.user!.companyId, req.user!.userId);
    sendSuccess(res, project, 201);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function updateProject(req: Request, res: Response): Promise<void> {
  try {
    const project = await projectsService.updateProject(req.params['id'] as string, req.user!.companyId, req.body, req.user!.userId);
    sendSuccess(res, project);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function archiveProject(req: Request, res: Response): Promise<void> {
  try {
    const project = await projectsService.archiveProject(req.params['id'] as string, req.user!.companyId, req.user!.userId);
    sendSuccess(res, project);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function inviteMember(req: Request, res: Response): Promise<void> {
  try {
    const member = await projectsService.inviteMember(req.params['id'] as string, req.user!.companyId, req.body, req.user!.userId);
    sendSuccess(res, member, 201);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function acceptInvitation(req: Request, res: Response): Promise<void> {
  try {
    const member = await projectsService.acceptInvitation(req.params['id'] as string, req.user!.userId);
    sendSuccess(res, member);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  try {
    const result = await projectsService.removeMember(req.params['id'] as string, req.user!.companyId, req.params['uid'] as string, req.user!.userId);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed', e.status ?? 500, e.code);
  }
}
