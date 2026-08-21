import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger';

const logSpy = () => vi.spyOn(console, 'log').mockImplementation(() => {});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createLogger', () => {
  it('defaults to info level, suppressing debug', () => {
    const spy = logSpy();
    const logger = createLogger(undefined);

    logger.debug('hidden');
    logger.info('shown');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(spy.mock.calls[0]![0] as string)).toMatchObject({
      level: 'info',
      message: 'shown',
    });
  });

  it('honours a configured level', () => {
    const spy = logSpy();
    const logger = createLogger('warn');

    logger.info('hidden');
    logger.warn('shown');
    logger.error('also shown');

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('falls back to info for an unrecognised level', () => {
    const spy = logSpy();
    const logger = createLogger('verbose');

    logger.debug('hidden');
    logger.info('shown');

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits structured fields alongside the message', () => {
    const spy = logSpy();
    createLogger('debug').debug('request', { path: '/api/health' });

    const entry = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(entry).toMatchObject({ level: 'debug', message: 'request', path: '/api/health' });
    expect(typeof entry.time).toBe('string');
  });
});
