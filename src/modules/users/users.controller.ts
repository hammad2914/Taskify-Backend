import { Request, Response } from 'express';
import * as usersService from './users.service';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response';

export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', limit = '20', search, department, status } = req.query as Record<string, string>;
    const result = await usersService.listUsers(
      req.user!.companyId,
      parseInt(page),
      parseInt(limit),
      search,
      department,
      status,
    );
    sendPaginated(res, result.users, result.total, parseInt(page), parseInt(limit));
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed to list users', e.status ?? 500, e.code);
  }
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  try {
    const user = await usersService.getUserById(req.params['id'] as string, req.user!.companyId);
    sendSuccess(res, user);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'User not found', e.status ?? 500, e.code);
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const user = await usersService.createUser(req.body, req.user!.companyId);
    sendSuccess(res, user, 201, 'User created and invitation sent');
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed to create user', e.status ?? 500, e.code);
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const user = await usersService.updateUser(req.params['id'] as string, req.user!.companyId, req.body);
    sendSuccess(res, user);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed to update user', e.status ?? 500, e.code);
  }
}

export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  try {
    const result = await usersService.updateUserStatus(req.params['id'] as string, req.user!.companyId, req.body.status as 'ACTIVE' | 'DISABLED');
    sendSuccess(res, result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed to update status', e.status ?? 500, e.code);
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const result = await usersService.deleteUser(req.params['id'] as string, req.user!.companyId);
    sendSuccess(res, result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    sendError(res, e.message ?? 'Failed to delete user', e.status ?? 500, e.code);
  }
}
