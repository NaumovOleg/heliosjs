import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Endpoint, Get, Post, Put, Patch, Delete, Options, Head, Query, Any } from '@heliosjs/core';
import { HTTP_METHODS } from '@heliosjs/core/types';

const ROUTE_META = 'controller:route';

function getRouteMeta(target: any, method: string) {
  return Reflect.getMetadata(ROUTE_META, target, method);
}

describe('Endpoint decorator', () => {
  it('sets GET route metadata', () => {
    class Ctrl {
      @Endpoint(HTTP_METHODS.GET, '/list')
      list() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'list');
    expect(meta.route).toBe('/list');
    expect(meta.method).toBe('GET');
  });

  it('defaults route to / when no pattern given', () => {
    class Ctrl {
      @Endpoint(HTTP_METHODS.POST)
      create() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'create');
    expect(meta.route).toBe('/');
    expect(meta.method).toBe('POST');
  });

  it('uppercases method', () => {
    class Ctrl {
      @Endpoint('get' as any, '/test')
      test() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'test');
    expect(meta.method).toBe('GET');
  });

  it('attaches middlewares to route metadata', () => {
    const mw = () => {};
    class Ctrl {
      @Endpoint(HTTP_METHODS.GET, '/guarded', [mw as any])
      guarded() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'guarded');
    expect(meta.middlewares).toContain(mw);
  });

  it('defaults middlewares to empty array', () => {
    class Ctrl {
      @Endpoint(HTTP_METHODS.GET, '/test')
      test() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'test');
    expect(meta.middlewares).toEqual([]);
  });

  it('warns and returns descriptor when originalMethod is undefined', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    class Ctrl {}
    // Simulate undefined method
    const desc: PropertyDescriptor = { value: undefined, writable: true, configurable: true, enumerable: true };
    Endpoint(HTTP_METHODS.GET, '/test')(Ctrl.prototype, 'missing', desc);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('HTTP method shortcut decorators', () => {
  it('Get sets GET method', () => {
    class Ctrl {
      @Get('/list')
      list() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'list');
    expect(meta.method).toBe('GET');
    expect(meta.route).toBe('/list');
  });

  it('Post sets POST method', () => {
    class Ctrl {
      @Post('/create')
      create() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'create');
    expect(meta.method).toBe('POST');
  });

  it('Put sets PUT method', () => {
    class Ctrl {
      @Put('/update')
      update() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'update');
    expect(meta.method).toBe('PUT');
  });

  it('Patch sets PATCH method', () => {
    class Ctrl {
      @Patch('/partial')
      patch() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'patch');
    expect(meta.method).toBe('PATCH');
  });

  it('Delete sets DELETE method', () => {
    class Ctrl {
      @Delete('/remove')
      remove() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'remove');
    expect(meta.method).toBe('DELETE');
  });

  it('Options sets OPTIONS method', () => {
    class Ctrl {
      @Options('/opts')
      opts() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'opts');
    expect(meta.method).toBe('OPTIONS');
  });

  it('Head sets HEAD method', () => {
    class Ctrl {
      @Head('/check')
      check() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'check');
    expect(meta.method).toBe('HEAD');
  });

  it('Query sets QUERY method', () => {
    class Ctrl {
      @Query('/search')
      search() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'search');
    expect(meta.method).toBe('QUERY');
  });

  it('Any sets ANY method with * route', () => {
    class Ctrl {
      @Any()
      catchAll() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'catchAll');
    expect(meta.method).toBe('ANY');
    expect(meta.route).toBe('*');
  });

  it('Any passes middlewares', () => {
    const mw = () => {};
    class Ctrl {
      @Any([mw as any])
      catchAll() {}
    }
    const meta = getRouteMeta(Ctrl.prototype, 'catchAll');
    expect(meta.middlewares).toContain(mw);
  });
});
