import { z } from 'zod';

export const registerSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  useHrIntegration: z.boolean().optional().default(false),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'New password and confirm password do not match',
  path: ['confirmPassword'],
});

export const updateCompanyNameSchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateCompanyNameInput = z.infer<typeof updateCompanyNameSchema>;
