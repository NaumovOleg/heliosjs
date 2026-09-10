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

export class Logger {
  private readonly config: Required<LoggerConfig>;
  private readonly context?: string;

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

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  fatal(message: string, ...args: unknown[]): void {
    this.write('fatal', message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.write('error', message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.write('warn', message, args);
  }

  log(message: string, ...args: unknown[]): void {
    this.write('log', message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.write('log', message, args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.write('debug', message, args);
  }

  verbose(message: string, ...args: unknown[]): void {
    this.write('verbose', message, args);
  }

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

export function setGlobalLogger(config: LoggerConfig | false): Logger {
  if (config === false) {
    globalLogger = new Logger({ level: 'silent' });
  } else {
    globalLogger = new Logger(config);
  }
  return globalLogger;
}

export function getGlobalLogger(): Logger {
  return globalLogger;
}
