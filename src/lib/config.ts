import { z } from 'zod';

const envSchema = z.object({
  TARGETS_TABLE: z.string().min(1), CHECKS_TABLE: z.string().min(1), ALERT_TOPIC_ARN: z.string().min(1),
  CHECK_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(8000),
  CHECKS_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  MAX_TARGETS_PER_RUN: z.coerce.number().int().min(1).max(500).default(100),
  STAGE: z.string().default('dev')
});
export const config = envSchema.parse(process.env);
