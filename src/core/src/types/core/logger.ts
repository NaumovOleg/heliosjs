export type LogLevel = 'silent' | 'fatal' | 'error' | 'warn' | 'log' | 'debug' | 'verbose';

export interface LoggerConfig {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  colors?: boolean;
}
