import { Request } from '@types';
import http from 'http';
import { URL } from 'url';
import { Body, Controller, Status, USE } from './controllers';

import { IsString } from 'class-validator';

class DTO {
  @IsString()
  name: string;
}

const auth = (req: Request) => {
  console.log('00000');
  req.body = 'name';

  return req;
};
const auth2 = (resp: any) => {
  resp = { hello: 'world' };

  return resp;
};

@Controller({
  prefix: 'base',
  responseInterceprors: auth2,
  requestInterceptors: [auth],
  middlewares: [auth],
})
// @Validate('body', DTO)
export class Controllera {
  // @Validate('body', DTO)
  @Status(300)
  @USE('/:nane', [auth])
  async test(@Body() body: any) {
    console.log('==============', body);
    return body;
  }
}

@Controller({
  prefix: 'api',
  controllers: [Controllera],
  responseInterceprors: [
    (resp) => {
      console.log('base responseInterceprors', resp);
      return 'done';
    },
  ],
})
export class App {}

const ctr = new App();

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Bad Request' }));
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  let body = '';
  if (['PUT', 'POST', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    for await (const chunk of req) {
      body += chunk;
    }
  }

  try {
    const response = await (ctr as any).handleRequest({
      method: req.method,
      url: parsedUrl,
      body,
      headers: req.headers,
    });

    console.log('ssssssssssssssssssssssss', response);

    res.statusCode = response.status ?? 200;
    res.setHeader('Content-Type', 'application/json');

    const resp = JSON.stringify(response.data ? response.data : response);
    res.end(resp);
  } catch (error: any) {
    res.statusCode = error.status ?? 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: error.message ?? 'Internal Server Error' }));
  }
});

const HOST = 'localhost';

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});
