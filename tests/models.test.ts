import { describe, expect, it } from 'vitest';
import { targetInputSchema } from '../src/models';
describe('targetInputSchema', () => {
  it('accepts a valid HTTP target', () => {
    expect(targetInputSchema.safeParse({ name: 'Website', type: 'http', host: 'https://example.com/health' }).success).toBe(true);
  });
  it('requires a port for TCP targets', () => {
    expect(targetInputSchema.safeParse({ name: 'SSH', type: 'tcp', host: 'example.com' }).success).toBe(false);
  });
  it('rejects non-URL HTTP targets', () => {
    expect(targetInputSchema.safeParse({ name: 'Website', type: 'http', host: 'example.com' }).success).toBe(false);
  });
  it('bounds interval values', () => {
    expect(targetInputSchema.safeParse({ name: 'Website', type: 'http', host: 'https://example.com', intervalSeconds: 1 }).success).toBe(false);
  });
});
