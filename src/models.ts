import { z } from 'zod';
export const targetInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(['http', 'tcp']),
  host: z.string().trim().min(1).max(253),
  port: z.number().int().min(1).max(65535).optional(),
  path: z.string().max(512).optional(),
  expectedStatus: z.number().int().min(100).max(599).default(200),
  intervalSeconds: z.number().int().min(60).max(3600).default(300),
  enabled: z.boolean().default(true)
}).superRefine((value, ctx) => {
  if (value.type === 'tcp' && value.port === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['port'], message: 'port is required for TCP checks' });
  if (value.type === 'http' && !/^https?:\/\//i.test(value.host)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['host'], message: 'HTTP target host must be an http:// or https:// URL' });
  if (value.type === 'http' && value.port !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['port'], message: 'Use the URL to specify an HTTP port' });
});
export type TargetInput = z.infer<typeof targetInputSchema>;
export interface Target extends TargetInput { id: string; createdAt: string; updatedAt: string; lastStatus?: 'UP' | 'DOWN' | 'UNKNOWN'; lastCheckedAt?: string; }
export interface CheckResult { targetId: string; checkedAt: string; status: 'UP' | 'DOWN'; latencyMs: number; message: string; httpStatus?: number; expiresAt: number; }
