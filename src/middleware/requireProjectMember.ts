import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { sendError } from '../utils/response';

/** Resolves a project ID from either req.params.projectId (project routes)
 *  or by looking up the task when req.params.id is a task ID (task routes).
 *  Pass `fromTask = true` for task routes. */
async function resolveProjectId(req: Request, fromTask: boolean): Promise<string | null> {
  if (fromTask) {
    const taskId = req.params['id'] as string;
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
    return task?.projectId ?? null;
  }
  return (req.params['projectId'] ?? req.params['id']) as string;
}

// ── Project-route guards (req.params.id = projectId) ────────────────────────

export async function requireProjectMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { user } = req;
  if (!user) { sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED'); return; }
  if (user.role === 'COMPANY_ADMIN' || user.role === 'SUPER_ADMIN') { next(); return; }

  const projectId = await resolveProjectId(req, false);
  if (!projectId) { sendError(res, 'Project not found', 404, 'NOT_FOUND'); return; }

  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId: user.userId, status: 'ACCEPTED' },
  });

  if (!member) { sendError(res, 'Not a project member', 403, 'NOT_PROJECT_MEMBER'); return; }
  next();
}

export async function requireProjectAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { user } = req;
  if (!user) { sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED'); return; }
  if (user.role === 'COMPANY_ADMIN' || user.role === 'SUPER_ADMIN') { next(); return; }

  const projectId = await resolveProjectId(req, false);
  if (!projectId) { sendError(res, 'Project not found', 404, 'NOT_FOUND'); return; }

  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId: user.userId, role: 'PROJECT_ADMIN', status: 'ACCEPTED' },
  });

  if (!member) { sendError(res, 'Project admin access required', 403, 'NOT_PROJECT_ADMIN'); return; }
  next();
}

// ── Task-route guards (req.params.id = taskId — project resolved via DB) ────

export async function requireTaskMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { user } = req;
  if (!user) { sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED'); return; }
  if (user.role === 'COMPANY_ADMIN' || user.role === 'SUPER_ADMIN') { next(); return; }

  const projectId = await resolveProjectId(req, true);
  if (!projectId) { sendError(res, 'Task not found', 404, 'NOT_FOUND'); return; }

  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId: user.userId, status: 'ACCEPTED' },
  });

  if (!member) { sendError(res, 'Not a project member', 403, 'NOT_PROJECT_MEMBER'); return; }
  next();
}

export async function requireTaskAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { user } = req;
  if (!user) { sendError(res, 'Not authenticated', 401, 'UNAUTHORIZED'); return; }
  if (user.role === 'COMPANY_ADMIN' || user.role === 'SUPER_ADMIN') { next(); return; }

  const projectId = await resolveProjectId(req, true);
  if (!projectId) { sendError(res, 'Task not found', 404, 'NOT_FOUND'); return; }

  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId: user.userId, role: 'PROJECT_ADMIN', status: 'ACCEPTED' },
  });

  if (!member) { sendError(res, 'Project admin access required', 403, 'NOT_PROJECT_ADMIN'); return; }
  next();
}
