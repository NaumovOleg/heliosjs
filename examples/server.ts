import { Controller } from 'quantum-flow/core';
import { Catch, Host, HttpServer, Intercept, Port, Server, Use } from 'quantum-flow/http';
import 'reflect-metadata';

import { Socket } from './controllers/socket';
import { User } from './controllers/user';

@Controller({
  prefix: 'api',
  controllers: [User, Socket],
  interceptors: [
    (resp: any) => {
      return resp;
    },
  ],
})
class Root {}

@Server({
  controllers: [Root],
  websocket: {
    enabled: true,
  },
})
@Port(3000)
@Host('localhost')
@Use((res: any) => res)
@Intercept((data: any, req, res) => {
  console.log(data, 'aaaaa', req);
  return data;
})
@Catch((r: any) => {
  console.log('.........', r);

  return r;
})
class App {}

const server = new HttpServer(App);

server.listen().catch(console.error);

// export const handler = LambdaAdapter.createHandler(Root);

// const postEvent = {
//   httpMethod: 'POST',
//   path: '/api/base/qq',
//   headers: {
//     'content-type': 'application/json',
//     authorization: 'Bearer token123',
//   },
//   queryStringParameters: {},
//   pathParameters: {},
//   body: JSON.stringify({
//     name: 'John Doe',
//     email: 'john@example.com',
//     age: 30,
//   }),
//   isBase64Encoded: false,
//   requestContext: {
//     stage: 'dev',
//   },
// } as any;

// // 3. POST с multipart/form-data
// const multipartEvent = {
//   httpMethod: 'POST',
//   path: '/api/base/qq',
//   headers: {
//     'content-type': 'multipart/form-data; boundary=---123',
//     authorization: 'Bearer token123',
//   },
//   queryStringParameters: {},
//   pathParameters: {},
//   body: '-----123\r\nContent-Disposition: form-data; name="name"\r\n\r\nJohn\r\n-----123\r\nContent-Disposition: form-data; name="avatar"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n[бинарные данные]\r\n-----123--',
//   isBase64Encoded: false,
//   requestContext: {
//     stage: 'dev',
//   },
// };

// const mockContext = {
//   awsRequestId: 'test-123',
//   callbackWaitsForEmptyEventLoop: true,
//   functionName: 'test-function',
//   functionVersion: '$LATEST',
//   invokedFunctionArn: 'arn:aws:lambda:test',
//   memoryLimitInMB: '128',
//   logGroupName: 'test-group',
//   logStreamName: 'test-stream',
//   getRemainingTimeInMillis: () => 5000,
//   done: () => {},
//   fail: () => {},
//   succeed: () => {},
// } as any;

// async function testLambda() {
//   const postResponse = await handler(postEvent, mockContext, 's' as any);
//   console.log('LAMBDA RESPONSE postResponse', postResponse);
// }

// // Запускаем тест
// testLambda().catch((err) => {
//   console.log('dddddddddddd', err);
// });
