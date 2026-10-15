import { describe, expect, it, vi } from 'vitest';
import { probeTarget } from '../src/services/probe';
import type { Target } from '../src/models';
const base: Target = { id: 'test', name: 'example', type: 'http', host: 'http://example.com', expectedStatus: 200, intervalSeconds: 300, enabled: true, createdAt: '', updatedAt: '' };
describe('probeTarget', () => {
  it('marks local hosts down without sending a request', async () => {
    const result = await probeTarget({ ...base, host: 'http://localhost' }, 1000);
    expect(result.status).toBe('DOWN');
    expect(result.message).toContain('Local target');
  });
  it('returns DOWN for an unsupported/unreachable address safely', async () => {
    const result = await probeTarget({ ...base, host: 'http://127.0.0.1' }, 1000);
    expect(result.status).toBe('DOWN');
  });
});
