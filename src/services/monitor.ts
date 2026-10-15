import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PublishCommand } from '@aws-sdk/client-sns';
import { config } from '../lib/config';
import { docClient, snsClient } from '../lib/aws';
import { logger } from '../lib/logger';
import type { Target, CheckResult } from '../models';
import { probeTarget } from './probe';

export async function runMonitoring(): Promise<{ checked: number; failed: number }> {
  const scan = await docClient.send(new ScanCommand({ TableName: config.TARGETS_TABLE, Limit: config.MAX_TARGETS_PER_RUN }));
  const targets = (scan.Items ?? []) as Target[];
  const enabled = targets.filter((target) => target.enabled);
  let failed = 0;
  // Bound concurrency to avoid a sudden burst against monitored systems.
  for (let i = 0; i < enabled.length; i += 10) {
    await Promise.all(enabled.slice(i, i + 10).map(async (target) => {
      const result = await probeTarget(target, config.CHECK_TIMEOUT_MS);
      const checkedAt = new Date().toISOString();
      const check: CheckResult = { targetId: target.id, checkedAt, status: result.status, latencyMs: result.latencyMs, message: result.message, httpStatus: result.httpStatus, expiresAt: Math.floor(Date.now() / 1000) + config.CHECKS_TTL_DAYS * 86400 };
      if (result.status === 'DOWN') failed += 1;
      await docClient.send(new PutCommand({ TableName: config.CHECKS_TABLE, Item: check }));
      const previous = await docClient.send(new GetCommand({ TableName: config.TARGETS_TABLE, Key: { id: target.id }, ConsistentRead: true }));
      const oldStatus = (previous.Item as Target | undefined)?.lastStatus;
      await docClient.send(new UpdateCommand({ TableName: config.TARGETS_TABLE, Key: { id: target.id }, UpdateExpression: 'SET lastStatus = :status, lastCheckedAt = :checkedAt, updatedAt = :updatedAt', ExpressionAttributeValues: { ':status': result.status, ':checkedAt': checkedAt, ':updatedAt': checkedAt } }));
      logger.info('target_checked', { targetId: target.id, status: result.status, latencyMs: result.latencyMs });
      if (oldStatus && oldStatus !== result.status) {
        const subject = `[NetWatch/${config.STAGE}] ${result.status === 'DOWN' ? 'ALERTA: indisponível' : 'RECUPERADO'} - ${target.name}`;
        await snsClient.send(new PublishCommand({ TopicArn: config.ALERT_TOPIC_ARN, Subject: subject.slice(0, 100), Message: JSON.stringify({ event: result.status === 'DOWN' ? 'target_down' : 'target_recovered', target: { id: target.id, name: target.name, type: target.type, host: target.host }, status: result.status, previousStatus: oldStatus, checkedAt, latencyMs: result.latencyMs, message: result.message }, null, 2) }));
      }
    }));
  }
  logger.info('monitor_run_complete', { checked: enabled.length, failed });
  return { checked: enabled.length, failed };
}
