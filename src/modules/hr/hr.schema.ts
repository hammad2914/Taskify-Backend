import { z } from 'zod';

export const testConnectionSchema = z.object({
  hrApiUrl: z.string().url('Must be a valid URL'),
});

export const hrEmployeeSchema = z.object({
  employeeId: z.string().min(1),
  fullName: z.string().min(2),
  email: z.string().email(),
  department: z.string().min(1),
  designation: z.string().min(1),
  status: z.enum(['active', 'inactive']),
});

export const hrResponseSchema = z.array(hrEmployeeSchema);

export type HrEmployee = z.infer<typeof hrEmployeeSchema>;
