import type { APIGatewayProxyResultV2 } from 'aws-lambda';
export function response(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return { statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }, body: JSON.stringify(body) };
}
export function parseBody<T>(body: string | undefined): T {
  if (!body) throw new Error('Request body is required');
  return JSON.parse(body) as T;
}
