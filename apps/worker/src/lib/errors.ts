import { createLogger } from './logger';

/**
 * Error contract: route handlers and the helpers they call return
 * `{ error: Response }`; pure logic throws. Callers narrow on `error` and
 * return it straight to Hono:
 *
 *   const result = await loadThing(id);
 *   if ('error' in result) return result.error;
 */
export type ErrorResult = { error: Response };

function jsonError(message: string, status: number): ErrorResult {
  return { error: Response.json({ error: message }, { status }) };
}

export function badRequest(msg: string): ErrorResult {
  return jsonError(msg, 400);
}

export function unauthorized(): ErrorResult {
  return jsonError('Unauthorized', 401);
}

export function notFound(): ErrorResult {
  return jsonError('Not found', 404);
}

export function tooManyRequests(): ErrorResult {
  return jsonError('Too many requests', 429);
}

export function serverError(err: unknown, logLevel?: string): ErrorResult {
  createLogger(logLevel).error('unhandled error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  return jsonError('Internal server error', 500);
}
