import { describe, expect, it } from 'vitest';
import { reflectMiddlewaresMetadata } from '@heliosjs/core/utils';
import { Use, Guard, Intercept, Pipe, Catch, Cors, Sanitize, Status, Ok200, Ok201, Ok204 } from '@heliosjs/middlewares';
import * as Joi from 'joi';

describe('@Use', () => {
  it('registers single middleware on class', () => {
    const mw = () => {};
    @Use(mw)
    class Ctrl {}
    const meta = reflectMiddlewaresMetadata(Ctrl);
    expect(meta.some((m: any) => m.middleware === mw)).toBe(true);
  });

  it('registers array of middlewares on class', () => {
    const mw1 = () => {};
    const mw2 = () => {};
    @Use([mw1, mw2])
    class Ctrl {}
    const meta = reflectMiddlewaresMetadata(Ctrl);
    expect(meta.filter((m: any) => m.middleware === mw1 || m.middleware === mw2).length).toBe(2);
  });

  it('registers middleware on method', () => {
    const mw = () => {};
    class Ctrl {
      @Use(mw)
      handler() {}
    }
    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler');
    expect(meta.some((m: any) => m.middleware === mw)).toBe(true);
  });
});

describe('@Guard', () => {
  it('registers function guard on class', () => {
    const guardFn = () => true;
    @Guard(guardFn)
    class Ctrl {}
    const meta = reflectMiddlewaresMetadata(Ctrl);
    expect(meta.some((m: any) => m.guard === guardFn)).toBe(true);
  });

  it('registers class guard', () => {
    class MyGuard {
      canActivate() { return true; }
    }
    @Guard(MyGuard)
    class Ctrl {}
    const meta = reflectMiddlewaresMetadata(Ctrl);
    expect(meta.some((m: any) => m.guard === MyGuard)).toBe(true);
  });

  it('registers guard on method', () => {
    const guardFn = () => true;
    class Ctrl {
      @Guard(guardFn)
      handler() {}
    }
    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler');
    expect(meta.some((m: any) => m.guard === guardFn)).toBe(true);
  });
});

describe('@Intercept', () => {
  it('registers interceptor on class', () => {
    const interceptor = async () => {};
    @Intercept(interceptor)
    class Ctrl {}
    const meta = reflectMiddlewaresMetadata(Ctrl);
    expect(meta.some((m: any) => m.interceptor === interceptor)).toBe(true);
  });

  it('registers interceptor on method', () => {
    const interceptor = async () => {};
    class Ctrl {
      @Intercept(interceptor)
      handler() {}
    }
    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler');
    expect(meta.some((m: any) => m.interceptor === interceptor)).toBe(true);
  });
});

describe('@Pipe', () => {
  it('registers pipe on class', () => {
    const pipe = { body: (b: any) => b };
    @Pipe(pipe)
    class Ctrl {}
    const meta = reflectMiddlewaresMetadata(Ctrl);
    expect(meta.some((m: any) => m.pipe === pipe)).toBe(true);
  });

  it('registers pipe on method', () => {
    const pipe = { query: (q: any) => q };
    class Ctrl {
      @Pipe(pipe)
      handler() {}
    }
    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler');
    expect(meta.some((m: any) => m.pipe === pipe)).toBe(true);
  });
});

describe('@Catch', () => {
  it('registers error handler on class', () => {
    const handler = () => {};
    @Catch(handler)
    class Ctrl {}
    const meta = reflectMiddlewaresMetadata(Ctrl);
    expect(meta.some((m: any) => m.errorHandler === handler)).toBe(true);
  });

  it('registers error handler on method', () => {
    const handler = () => {};
    class Ctrl {
      @Catch(handler)
      handler() {}
    }
    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler');
    expect(meta.some((m: any) => m.errorHandler === handler)).toBe(true);
  });
});

describe('@Cors', () => {
  it('registers default CORS config on class', () => {
    @Cors()
    class Ctrl {}
    const meta = reflectMiddlewaresMetadata(Ctrl);
    expect(meta.some((m: any) => m.cors)).toBe(true);
    const corsMeta = meta.find((m: any) => m.cors);
    expect(corsMeta.cors.origin).toBe('*');
  });

  it('registers custom CORS config', () => {
    @Cors({ origin: 'http://example.com', methods: ['GET'] })
    class Ctrl {}
    const meta = reflectMiddlewaresMetadata(Ctrl);
    const corsMeta = meta.find((m: any) => m.cors);
    expect(corsMeta.cors.origin).toBe('http://example.com');
    expect(corsMeta.cors.methods).toEqual(['GET']);
  });

  it('registers CORS on method', () => {
    class Ctrl {
      @Cors({ origin: 'http://method.com' })
      handler() {}
    }
    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler');
    expect(meta.some((m: any) => m.cors?.origin === 'http://method.com')).toBe(true);
  });
});

describe('@Sanitize', () => {
  it('registers single config on class', () => {
    const config = { type: 'body' as const, schema: Joi.any() };
    @Sanitize(config)
    class Ctrl {}
    const meta = reflectMiddlewaresMetadata(Ctrl);
    expect(meta.some((m: any) => m.sanitizer === config)).toBe(true);
  });

  it('registers array of configs', () => {
    const c1 = { type: 'body' as const, schema: Joi.any() };
    const c2 = { type: 'query' as const, schema: Joi.any() };
    @Sanitize([c1, c2])
    class Ctrl {}
    const meta = reflectMiddlewaresMetadata(Ctrl);
    expect(meta.filter((m: any) => m.sanitizer).length).toBe(2);
  });

  it('registers on method', () => {
    const config = { type: 'body' as const, schema: Joi.any() };
    class Ctrl {
      @Sanitize(config)
      handler() {}
    }
    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler');
    expect(meta.some((m: any) => m.sanitizer === config)).toBe(true);
  });
});

describe('@Status', () => {
  it('sets status on method', () => {
    class Ctrl {
      @Status(201)
      handler() {}
    }
    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler');
    expect(meta.some((m: any) => m.status === 201)).toBe(true);
  });

  it('Ok200 sets status 200', () => {
    class Ctrl {
      @Ok200()
      handler() {}
    }
    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler');
    expect(meta.some((m: any) => m.status === 200)).toBe(true);
  });

  it('Ok201 sets status 201', () => {
    class Ctrl {
      @Ok201()
      handler() {}
    }
    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler');
    expect(meta.some((m: any) => m.status === 201)).toBe(true);
  });

  it('Ok204 sets status 204', () => {
    class Ctrl {
      @Ok204()
      handler() {}
    }
    const meta = reflectMiddlewaresMetadata(Ctrl.prototype, 'handler');
    expect(meta.some((m: any) => m.status === 204)).toBe(true);
  });
});
