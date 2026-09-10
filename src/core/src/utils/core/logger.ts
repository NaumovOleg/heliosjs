import type { LoggerConfig, LogLevel } from '../../types/core/logger';

export type { LoggerConfig, LogLevel };

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: -1,
  fatal: 0,
  error: 1,
  warn: 2,
  log: 3,
  debug: 4,
  verbose: 5,
};

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
} as const;

const LEVEL_LABELS: Record<string, string> = {
  fatal: 'FATAL',
  error: 'ERROR',
  warn: 'WARN',
  log: 'LOG',
  debug: 'DEBUG',
  verbose: 'VERBOSE',
};

const LEVEL_COLORS: Record<string, keyof typeof COLORS> = {
  fatal: 'red',
  error: 'red',
  warn: 'yellow',
  log: 'green',
  debug: 'cyan',
  verbose: 'gray',
};

/**
 * Small leveled console logger used across the framework and available to
 * application code. Writes `error`/`fatal` to `console.error`, `warn` to
 * `console.warn`, everything else to `console.log`, each line prefixed with an
 * optional timestamp, the level label, the configured prefix, and an optional
 * per-instance context tag. Colors are ANSI and on by default.
 *
 * Levels, most to least severe: `fatal`, `error`, `warn`, `log`, `debug`,
 * `verbose` — plus `silent` which suppresses everything. A message is printed
 * only when its level is at least as severe as the configured `level`.
 *
 * @example
 * const log = new Logger({ level: 'debug', prefix: 'Payments' });
 * log.info('charge ok', { id });
 * log.child('webhooks').warn('retrying');
 */
export class Logger {
  private readonly config: Required<LoggerConfig>;
  private readonly context?: string;

  /**
   * @param contextOrConfig - Either a context string (uses default config) or a
   *   {@link LoggerConfig} (`level`, `prefix`, `timestamp`, `colors`). Defaults:
   *   `level: 'log'`, `prefix: 'Helios'`, `timestamp: true`, `colors: true`.
   * @param context - Optional context tag appended after the prefix, used when
   *   the first argument is a config object.
   */
  constructor(contextOrConfig?: string | LoggerConfig, context?: string) {
    if (typeof contextOrConfig === 'string') {
      this.context = contextOrConfig;
      this.config = {
        level: 'log',
        prefix: 'Helios',
        timestamp: true,
        colors: true,
      };
    } else {
      this.context = context;
      this.config = {
        level: contextOrConfig?.level ?? 'log',
        prefix: contextOrConfig?.prefix ?? 'Helios',
        timestamp: contextOrConfig?.timestamp ?? true,
        colors: contextOrConfig?.colors ?? true,
      };
    }
  }

  /**
   * Changes the minimum level printed. Accepts `'silent' | 'fatal' | 'error' |
   * 'warn' | 'log' | 'debug' | 'verbose'`. `'silent'` mutes the logger.
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /** Returns the current minimum level. */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /** Logs at `fatal` (highest severity) to `console.error`. `args` are passed through. */
  fatal(message: string, ...args: unknown[]): void {
    this.write('fatal', message, args);
  }

  /** Logs at `error` to `console.error`. `args` are passed through. */
  error(message: string, ...args: unknown[]): void {
    this.write('error', message, args);
  }

  /** Logs at `warn` to `console.warn`. `args` are passed through. */
  warn(message: string, ...args: unknown[]): void {
    this.write('warn', message, args);
  }

  /** Logs at `log` (the default level) to `console.log`. `args` are passed through. */
  log(message: string, ...args: unknown[]): void {
    this.write('log', message, args);
  }

  /** Alias of {@link Logger.log} — logs at the `log` level. */
  info(message: string, ...args: unknown[]): void {
    this.write('log', message, args);
  }

  /** Logs at `debug` (printed only when level is `debug` or `verbose`). */
  debug(message: string, ...args: unknown[]): void {
    this.write('debug', message, args);
  }

  /** Logs at `verbose` (the lowest severity; printed only when level is `verbose`). */
  verbose(message: string, ...args: unknown[]): void {
    this.write('verbose', message, args);
  }

  /**
   * Returns a new logger with the same config but an added context tag, printed
   * after the prefix. Use per subsystem, e.g. `logger.child('db')`.
   *
   * @param context - The context label for the child logger.
   */
  child(context: string): Logger {
    return new Logger(
      {
        ...this.config,
        level: this.config.level,
      },
      context
    );
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.config.level];
  }

  private write(level: LogLevel, message: string, args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const parts: string[] = [];

    if (this.config.timestamp) {
      const ts = new Date().toISOString();
      parts.push(this.config.colors ? `${COLORS.gray}${ts}${COLORS.reset}` : ts);
    }

    const label = LEVEL_LABELS[level];
    if (this.config.colors) {
      const color = COLORS[LEVEL_COLORS[level]];
      parts.push(`${color}${COLORS.bold}[${label}]${COLORS.reset}`);
    } else {
      parts.push(`[${label}]`);
    }

    if (this.config.prefix) {
      parts.push(
        this.config.colors
          ? `${COLORS.cyan}${this.config.prefix}${COLORS.reset}`
          : this.config.prefix
      );
    }

    if (this.context) {
      parts.push(
        this.config.colors ? `${COLORS.gray}${this.context}${COLORS.reset}` : this.context
      );
    }

    parts.push(message);

    const line = parts.join(' ');

    switch (level) {
      case 'fatal':
      case 'error':
        // eslint-disable-next-line no-console
        console.error(line, ...args);
        break;
      case 'warn':
        // eslint-disable-next-line no-console
        console.warn(line, ...args);
        break;
      default:
        // eslint-disable-next-line no-console
        console.log(line, ...args);
    }
  }
}

let globalLogger = new Logger();

/**
 * Replaces the process-wide logger that the framework uses for internal messages
 * (startup, plugin failures, error logging). Adapters call this from their `log`
 * config; call it directly to control framework logging outside an adapter.
 *
 * @param config - A {@link LoggerConfig} to build the new logger from, or `false`
 *   to silence framework logging entirely (`level: 'silent'`).
 * @returns The newly installed logger instance.
 */
export function setGlobalLogger(config: LoggerConfig | false): Logger {
  if (config === false) {
    globalLogger = new Logger({ level: 'silent' });
  } else {
    globalLogger = new Logger(config);
  }
  return globalLogger;
}

/**
 * Returns the current process-wide framework logger (a default `Logger` until
 * {@link setGlobalLogger} is called). Use it to emit messages that should share
 * the framework's format and level.
 */
export function getGlobalLogger(): Logger {
  return globalLogger;
}
