import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Body, Params, QueryParam, Req, Res, Headers, Cookies, Files, Fingerprint } from '@heliosjs/core';

const ROUTE_META = 'controller:route';

function getParams(target: any, method: string) {
  const meta = Reflect.getMetadata(ROUTE_META, target, method);
  return meta?.parameters ?? [];
}

describe('Parameter decorators', () => {
  describe('@Body', () => {
    it('creates body parameter decorator', () => {
      class Ctrl {
        handler(@Body() body: any) {}
      }
      const params = getParams(Ctrl.prototype, 'handler');
      expect(params).toHaveLength(1);
      expect(params[0].type).toBe('body');
    });

    it('creates body decorator with dto', () => {
      class UserDto {}
      class Ctrl {
        handler(@Body(UserDto) body: UserDto) {}
      }
      const params = getParams(Ctrl.prototype, 'handler');
      expect(params[0].dto).toBe(UserDto);
    });

    it('creates body decorator with name string', () => {
      class Ctrl {
        handler(@Body('name') name: string) {}
      }
      const params = getParams(Ctrl.prototype, 'handler');
      expect(params[0].name).toBe('name');
    });

    it('creates body decorator with dto and options', () => {
      class UserDto {}
      const opts = { whitelist: true };
      class Ctrl {
        handler(@Body(UserDto, opts) body: UserDto) {}
      }
      const params = getParams(Ctrl.prototype, 'handler');
      expect(params[0].dto).toBe(UserDto);
      expect(params[0].options).toBe(opts);
    });

    it('creates body decorator with dto, name, and options', () => {
      class UserDto {}
      const opts = { whitelist: true };
      class Ctrl {
        handler(@Body(UserDto, 'user', opts) body: UserDto) {}
      }
      const params = getParams(Ctrl.prototype, 'handler');
      expect(params[0].dto).toBe(UserDto);
      expect(params[0].name).toBe('user');
      expect(params[0].options).toBe(opts);
    });
  });

  describe('@Params', () => {
    it('creates params parameter decorator', () => {
      class Ctrl {
        handler(@Params() params: any) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].type).toBe('params');
    });

    it('creates params with specific name', () => {
      class Ctrl {
        handler(@Params('id') id: string) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].name).toBe('id');
    });

    it('creates params with dto', () => {
      class ParamsDto {}
      class Ctrl {
        handler(@Params(ParamsDto) params: ParamsDto) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].dto).toBe(ParamsDto);
    });
  });

  describe('@QueryParam', () => {
    it('creates query parameter decorator', () => {
      class Ctrl {
        handler(@QueryParam() query: any) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].type).toBe('query');
    });

    it('creates query with specific name', () => {
      class Ctrl {
        handler(@QueryParam('search') search: string) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].name).toBe('search');
    });

    it('creates query with dto', () => {
      class QueryDto {}
      class Ctrl {
        handler(@QueryParam(QueryDto) query: QueryDto) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].dto).toBe(QueryDto);
    });
  });

  describe('@Req', () => {
    it('creates request parameter decorator', () => {
      class Ctrl {
        handler(@Req() req: any) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].type).toBe('request');
    });
  });

  describe('@Res', () => {
    it('creates response parameter decorator', () => {
      class Ctrl {
        handler(@Res() res: any) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].type).toBe('response');
    });
  });

  describe('@Headers', () => {
    it('creates headers parameter decorator', () => {
      class Ctrl {
        handler(@Headers() headers: any) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].type).toBe('headers');
    });

    it('creates headers with specific name', () => {
      class Ctrl {
        handler(@Headers('authorization') auth: string) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].name).toBe('authorization');
    });
  });

  describe('@Cookies', () => {
    it('creates cookies parameter decorator', () => {
      class Ctrl {
        handler(@Cookies() cookies: any) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].type).toBe('cookies');
    });

    it('creates cookies with specific name', () => {
      class Ctrl {
        handler(@Cookies('sessionId') sid: string) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].name).toBe('sessionId');
    });
  });

  describe('@Files', () => {
    it('creates multipart parameter decorator', () => {
      class Ctrl {
        handler(@Files() files: any) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].type).toBe('multipart');
    });

    it('creates files with specific name', () => {
      class Ctrl {
        handler(@Files('avatar') file: any) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].name).toBe('avatar');
    });
  });

  describe('@Fingerprint', () => {
    it('creates fingerprint parameter decorator', () => {
      class Ctrl {
        handler(@Fingerprint() fp: string) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p[0].type).toBe('fingerprint');
    });
  });

  describe('multiple parameters', () => {
    it('accumulates multiple parameter decorators on the same method', () => {
      class Ctrl {
        handler(
          @Body() body: any,
          @Params('id') id: string,
          @QueryParam('sort') sort: string,
          @Headers('x-token') token: string,
        ) {}
      }
      const p = getParams(Ctrl.prototype, 'handler');
      expect(p).toHaveLength(4);
      expect(p.map((x: any) => x.type)).toEqual(['headers', 'query', 'params', 'body']);
    });
  });
});
