import { z } from 'zod';

export const generateReportSchema = z.object({
  title: z.string().min(2),
  type: z.enum(['PROJECT_SUMMARY', 'TIMELINE_ANALYSIS', 'RISK_DETECTION', 'USER_PERFORMANCE', 'PRODUCTIVITY_INSIGHTS']),
  projectId: z.string().uuid().optional(),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;
