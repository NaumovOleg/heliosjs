/**
 * `Logger` severity level, most to least severe: `'fatal'`, `'error'`, `'warn'`,
 * `'log'` (the default), `'debug'`, `'verbose'`. `'silent'` suppresses all
 * output. A message prints only when its level is at least as severe as the
 * logger's configured level.
 */
export type LogLevel = 'silent' | 'fatal' | 'error' | 'warn' | 'log' | 'debug' | 'verbose';

/** Options for constructing a `Logger` (and the `log` field of `@Server`/`GrpcServer` config). */
export interface LoggerConfig {
  /** Minimum level to print. Default `'log'`. */
  level?: LogLevel;
  /** Label printed after the level tag. Default `'Helios'`. */
  prefix?: string;
  /** Prepend an ISO timestamp to each line. Default `true`. */
  timestamp?: boolean;
  /** Colorize output with ANSI codes. Default `true`. */
  colors?: boolean;
}
