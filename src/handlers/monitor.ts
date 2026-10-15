import type { ScheduledHandler } from 'aws-lambda';
import { logger } from '../lib/logger';
import { runMonitoring } from '../services/monitor';
export const handler: ScheduledHandler = async () => {
  try { await runMonitoring(); }
  catch (error) { logger.error('monitor_run_failed', { error: error instanceof Error ? error.message : 'Unknown error' }); throw error; }
};
