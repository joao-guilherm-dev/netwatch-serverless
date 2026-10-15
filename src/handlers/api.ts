import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { docClient } from '../lib/aws';
import { config } from '../lib/config';
import { response, parseBody } from '../lib/http';
import { logger } from '../lib/logger';
import { targetInputSchema, type Target } from '../models';

function badRequest(message: string, details?: unknown) { return response(400, { error: message, details }); }
function serverError(error: unknown) { logger.error('api_error', { error: error instanceof Error ? error.message : 'Unknown error' }); return response(500, { error: 'Internal server error' }); }
export const createTarget: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const input = targetInputSchema.safeParse(parseBody<unknown>(event.body));
    if (!input.success) return badRequest('Invalid target', input.error.flatten());
    const now = new Date().toISOString();
    const target: Target = { ...input.data, id: randomUUID(), createdAt: now, updatedAt: now, lastStatus: 'UNKNOWN' };
    await docClient.send(new PutCommand({ TableName: config.TARGETS_TABLE, Item: target, ConditionExpression: 'attribute_not_exists(id)' }));
    return response(201, target);
  } catch (error) { if (error instanceof SyntaxError || (error instanceof Error && error.message === 'Request body is required')) return badRequest(error.message); return serverError(error); }
};
export const listTargets: APIGatewayProxyHandlerV2 = async () => {
  try { const result = await docClient.send(new ScanCommand({ TableName: config.TARGETS_TABLE, Limit: 200 })); return response(200, { items: result.Items ?? [] }); }
  catch (error) { return serverError(error); }
};
const updateSchema = z.object({ name: z.string().trim().min(1).max(100).optional(), enabled: z.boolean().optional(), intervalSeconds: z.number().int().min(60).max(3600).optional(), expectedStatus: z.number().int().min(100).max(599).optional(), path: z.string().max(512).optional() }).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');
export const updateTarget: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const id = event.pathParameters?.id; if (!id) return badRequest('Target id is required');
    const parsed = updateSchema.safeParse(parseBody<unknown>(event.body)); if (!parsed.success) return badRequest('Invalid update', parsed.error.flatten());
    const existing = await docClient.send(new GetCommand({ TableName: config.TARGETS_TABLE, Key: { id } })); if (!existing.Item) return response(404, { error: 'Target not found' });
    const entries = Object.entries(parsed.data); const names: Record<string, string> = {}; const values: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };
    const sets = entries.map(([key, value], index) => { names[`#k${index}`] = key; values[`:v${index}`] = value; return `#k${index} = :v${index}`; });
    sets.push('updatedAt = :updatedAt');
    const result = await docClient.send(new UpdateCommand({ TableName: config.TARGETS_TABLE, Key: { id }, UpdateExpression: `SET ${sets.join(', ')}`, ExpressionAttributeNames: names, ExpressionAttributeValues: values, ReturnValues: 'ALL_NEW' }));
    return response(200, result.Attributes);
  } catch (error) { if (error instanceof SyntaxError || (error instanceof Error && error.message === 'Request body is required')) return badRequest(error.message); return serverError(error); }
};
export const deleteTarget: APIGatewayProxyHandlerV2 = async (event) => {
  try { const id = event.pathParameters?.id; if (!id) return badRequest('Target id is required'); const result = await docClient.send(new DeleteCommand({ TableName: config.TARGETS_TABLE, Key: { id }, ReturnValues: 'ALL_OLD' })); if (!result.Attributes) return response(404, { error: 'Target not found' }); return response(200, { deleted: true, id }); }
  catch (error) { return serverError(error); }
};
export const listChecks: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const targetId = event.pathParameters?.id; if (!targetId) return badRequest('Target id is required');
    const limit = Math.max(1, Math.min(100, Number(event.queryStringParameters?.limit ?? 50) || 50));
    const result = await docClient.send(new QueryCommand({ TableName: config.CHECKS_TABLE, KeyConditionExpression: 'targetId = :id', ExpressionAttributeValues: { ':id': targetId }, ScanIndexForward: false, Limit: limit }));
    return response(200, { items: result.Items ?? [] });
  } catch (error) { return serverError(error); }
};
