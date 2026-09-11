import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Controller, Get } from '@heliosjs/core';
import { looksReDoSRisky } from '@heliosjs/core/utils';

describe('looksReDoSRisky', () => {
  it('flags nested-quantifier patterns (the classic catastrophic-backtracking shape)', () => {
    expect(looksReDoSRisky('(a+)+')).toBe(true);
    expect(looksReDoSRisky('(a*)*')).toBe(true);
    expect(looksReDoSRisky('([a-z]+){2,}')).toBe(true);
  });

  it('does not flag ordinary route-param patterns', () => {
    expect(looksReDoSRisky('\\d+')).toBe(false);
    expect(looksReDoSRisky('[a-z]+')).toBe(false);
    expect(looksReDoSRisky('uuid|slug')).toBe(false);
    expect(looksReDoSRisky('[0-9a-f]{8}-[0-9a-f]{4}')).toBe(false);
  });
});

describe('route regex ReDoS warning (integration)', () => {
  // Matches the pattern __tests__/core/unit/decorators/controller.test.ts uses
  // to instantiate a @Controller-wrapped class directly (parent meta object).
  const parentMeta = { prefix: '/', name: 'Parent', functions: [], routes: [] };

  it('warns once at route-registration time for a risky inline route regex', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      @Controller('/items')
      class RiskyController {
        @Get('/:id((a+)+)')
        get() {
          return {};
        }
      }
      new RiskyController(parentMeta as never);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.join(' ')).toMatch(/ReDoS/);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not warn for an ordinary inline route regex', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      @Controller('/users')
      class NormalController {
        @Get('/:id(\\d+)')
        get() {
          return {};
        }
      }
      new NormalController(parentMeta as never);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
