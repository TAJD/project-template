import { describe, expect, it, vi } from 'vitest';
import { badRequest, notFound, serverError, unauthorized } from './errors';

describe('error contract', () => {
  it('badRequest returns a 400 error result', async () => {
    const { error } = badRequest('name is required');
    expect(error.status).toBe(400);
    expect(await error.json()).toEqual({ error: 'name is required' });
  });

  it('unauthorized returns a 401 error result', async () => {
    const { error } = unauthorized();
    expect(error.status).toBe(401);
    expect(await error.json()).toEqual({ error: 'Unauthorized' });
  });

  it('notFound returns a 404 error result', async () => {
    const { error } = notFound();
    expect(error.status).toBe(404);
    expect(await error.json()).toEqual({ error: 'Not found' });
  });

  it('serverError does not leak the underlying error message', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { error } = serverError(new Error('D1_ERROR: no such column: secret_token'));

    expect(error.status).toBe(500);
    expect(await error.json()).toEqual({ error: 'Internal server error' });
    spy.mockRestore();
  });

  it('serverError logs the underlying error', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    serverError(new Error('boom'));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(spy.mock.calls[0]![0] as string)).toMatchObject({
      level: 'error',
      message: 'unhandled error',
      error: 'boom',
    });
    spy.mockRestore();
  });
});
