import { z } from 'zod';

export const createUserSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  department: z.string().optional(),
  designation: z.string().optional(),
  role: z.enum(['MEMBER', 'COMPANY_ADMIN']).optional().default('MEMBER'),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']),
});

export const listUsersQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  search: z.string().optional(),
  department: z.string().optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'DISABLED']).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
