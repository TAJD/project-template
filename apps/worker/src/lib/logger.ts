export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function log(
  level: LogLevel,
  configuredLevel: LogLevel | undefined,
  message: string,
  fields?: Record<string, unknown>,
): void {
  const minLevel = configuredLevel ?? 'info';
  if (LEVELS[level] < LEVELS[minLevel]) return;

  console.log(
    JSON.stringify({
      level,
      message,
      time: new Date().toISOString(),
      ...fields,
    }),
  );
}

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export function createLogger(logLevel: string | undefined): Logger {
  const configuredLevel = isLogLevel(logLevel) ? logLevel : undefined;
  return {
    debug: (message, fields) => log('debug', configuredLevel, message, fields),
    info: (message, fields) => log('info', configuredLevel, message, fields),
    warn: (message, fields) => log('warn', configuredLevel, message, fields),
    error: (message, fields) => log('error', configuredLevel, message, fields),
  };
}

function isLogLevel(value: string | undefined): value is LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error';
}
