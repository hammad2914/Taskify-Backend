import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  assigneeId: z.string().uuid(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  startDate: z.string().datetime(),
  deadline: z.string().datetime(),
  attachments: z.array(z.string()).max(10).optional().default([]),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  startDate: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(),
  attachments: z.array(z.string()).max(10).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),
});

export const addCommentSchema = z.object({
  content: z.string().min(1),
  files: z.array(z.string()).optional().default([]),
});

export const requestRevisionSchema = z.object({
  comment: z.string().min(1, 'Please provide a reason for revision request'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
