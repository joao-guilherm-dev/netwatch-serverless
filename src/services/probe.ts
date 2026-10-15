
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import type { Target } from '../models';

export interface ProbeResult {
  status: 'UP' | 'DOWN';
  latencyMs: number;
  message: string;
  httpStatus?: number;
}

export async function probeTarget(
  target: Target,
  timeoutMs: number
): Promise<ProbeResult> {
  const started = Date.now();

  try {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error('Timeout must be a positive number');
    }

    if (target.type === 'http') {
      const url = new URL(target.host);

      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Only HTTP and HTTPS URLs are allowed');
      }

      if (url.username || url.password) {
        throw new Error('Credentials in target URL are not allowed');
      }

      const hostname = url.hostname.toLowerCase();

      if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === '::1' ||
        hostname === '0.0.0.0'
      ) {
        throw new Error('Local target addresses are not allowed');
      }

      const resolved = await lookup(hostname, {
        all: true,
        verbatim: true
      });

      if (
        resolved.length === 0 ||
        resolved.some((entry) => isPrivateIp(entry.address))
      ) {
        throw new Error('Private or local target addresses are not allowed');
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'manual',
          headers: { 'user-agent': 'NetWatch-Monitor/1.0' }
        });

        await response.body?.cancel();

        const ok = response.status === target.expectedStatus;

        return {
          status: ok ? 'UP' : 'DOWN',
          latencyMs: Date.now() - started,
          message: ok
            ? 'Expected HTTP status received'
            : `Unexpected HTTP status: ${response.status}`,
          httpStatus: response.status
        };
      } finally {
        clearTimeout(timer);
      }
    }

    if (target.type === 'tcp') {
      if (
        target.port === undefined ||
        !Number.isInteger(target.port) ||
        target.port < 1 ||
        target.port > 65535
      ) {
        throw new Error('A valid TCP port is required');
      }

      const resolved = await lookup(target.host, {
        all: true,
        verbatim: true
      });

      if (
        resolved.length === 0 ||
        resolved.some((entry) => isPrivateIp(entry.address))
      ) {
        throw new Error('Private or local target addresses are not allowed');
      }

      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection({
          host: target.host,
          port: target.port as number
        });

        const timer = setTimeout(() => {
          socket.destroy(new Error('TCP connection timed out'));
        }, timeoutMs);

        socket.once('connect', () => {
          clearTimeout(timer);
          socket.end();
          resolve();
        });

        socket.once('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });

      return {
        status: 'UP',
        latencyMs: Date.now() - started,
        message: 'TCP connection succeeded'
      };
    }

    return {
      status: 'DOWN',
      latencyMs: Date.now() - started,
      message: 'Unsupported target type'
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Probe failed';

    return {
      status: 'DOWN',
      latencyMs: Date.now() - started,
      message: message.slice(0, 240)
    };
  }
}

function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const value = ip.toLowerCase();

    return (
      value === '::1' ||
      value === '::' ||
      value.startsWith('fc') ||
      value.startsWith('fd') ||
      value.startsWith('fe80:') ||
      value.startsWith('::ffff:127.') ||
      value.startsWith('::ffff:10.') ||
      value.startsWith('::ffff:192.168.') ||
      value.startsWith('::ffff:172.')
    );
  }

  const octets = ip.split('.').map(Number);

  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }

  const [a, b] = octets;

  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}
