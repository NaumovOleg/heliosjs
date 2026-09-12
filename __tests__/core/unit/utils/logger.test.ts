import { describe, expect, it, vi, afterEach } from 'vitest';
import { Logger, setGlobalLogger, getGlobalLogger } from '../../../../src/core/src/utils/core/logger';

describe('Logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('string constructor overload uses default config and sets context', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger('webhooks');
    logger.log('hello');
    expect(logSpy).toHaveBeenCalledOnce();
    const line = logSpy.mock.calls[0][0] as string;
    expect(line).toContain('webhooks');
    expect(line).toContain('Helios');
    expect(line).toContain('hello');
  });

  it('config object overload applies defaults for omitted fields', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger({});
    expect(logger.getLevel()).toBe('log');
    logger.log('msg');
    expect(logSpy).toHaveBeenCalledOnce();
  });

  it('setLevel/getLevel round-trip', () => {
    const logger = new Logger();
    logger.setLevel('debug');
    expect(logger.getLevel()).toBe('debug');
  });

  it('suppresses messages below the configured level', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger({ level: 'log' });
    logger.debug('hidden');
    logger.verbose('hidden');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('verbose level prints debug and verbose messages', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger({ level: 'verbose' });
    logger.debug('shown');
    logger.verbose('shown');
    expect(logSpy).toHaveBeenCalledTimes(2);
  });

  it('silent level suppresses everything including fatal/error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = new Logger({ level: 'silent' });
    logger.fatal('x');
    logger.error('x');
    logger.warn('x');
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('fatal and error write to console.error, warn to console.warn, info aliases log', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger({ level: 'verbose' });
    logger.fatal('a');
    logger.error('b');
    logger.warn('c');
    logger.info('d');
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(logSpy).toHaveBeenCalledOnce();
  });

  it('omits color codes when colors is false', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger({ colors: false });
    logger.log('plain');
    const line = logSpy.mock.calls[0][0] as string;
    expect(line).not.toContain('\x1b[');
    expect(line).toContain('[LOG]');
  });

  it('omits the timestamp when timestamp is false', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger({ timestamp: false, colors: false });
    logger.log('no-ts');
    const line = logSpy.mock.calls[0][0] as string;
    expect(line).toBe('[LOG] Helios no-ts');
  });

  it('omits the prefix segment when prefix is empty', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger({ timestamp: false, colors: false, prefix: '' });
    logger.log('no-prefix');
    const line = logSpy.mock.calls[0][0] as string;
    expect(line).toBe('[LOG] no-prefix');
  });

  it('child() carries the parent config and appends a context tag', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = new Logger({ timestamp: false, colors: false, prefix: 'App' });
    const child = logger.child('db');
    child.log('connected');
    expect(logSpy.mock.calls[0][0]).toBe('[LOG] App db connected');
  });
});

describe('global logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setGlobalLogger({});
  });

  it('getGlobalLogger returns a Logger instance by default', () => {
    expect(getGlobalLogger()).toBeInstanceOf(Logger);
  });

  it('setGlobalLogger(false) silences it entirely', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = setGlobalLogger(false);
    expect(logger.getLevel()).toBe('silent');
    logger.fatal('should not print');
    expect(errorSpy).not.toHaveBeenCalled();
    expect(getGlobalLogger()).toBe(logger);
  });

  it('setGlobalLogger(config) installs a logger built from that config', () => {
    const logger = setGlobalLogger({ level: 'debug', prefix: 'Custom' });
    expect(logger.getLevel()).toBe('debug');
    expect(getGlobalLogger()).toBe(logger);
  });
});
