import { IsString } from 'class-validator';

import {
  Body,
  Controller,
  Headers,
  IWebSocketService,
  Params,
  PUT,
  Query,
  Request,
  Response,
  USE,
} from 'quantum-flow/core';

import { Cors, Status, Use } from 'quantum-flow/middlewares';
import { OnSSEClose, OnSSEConnection, OnSSEError } from 'quantum-flow/sse';
import { InjectWS } from 'quantum-flow/ws';

import * as Joi from 'joi';
import { UserMetadata } from './userMetadata';
const params = Joi.object({
  meta: Joi.string().trim().min(2).max(50).required(),
});

class DTO {
  constructor() {}
  @IsString()
  name: string;
}

@Controller({
  prefix: 'user',
  controllers: [UserMetadata],
  middlewares: [function UserGlobalUse() {}],
  interceptor: (data, req, res) => {
    return { data, intercepted: true };
  },
})
@Cors({ origin: '*' })
@Use(function s1() {})
export class User {
  @Status(201)
  @PUT(':id')
  async createUser(
    @Body(DTO) body: DTO,
    @Query() query: any,
    @Headers() headers: any,
    @InjectWS() ws: IWebSocketService,
    @Request() req: any,
    @Params() params: any,
    @Response() resp: any,
  ) {
    return { body, query, headers, params };
  }

  @Status(300)
  @USE()
  async any(@Response() resp: any) {
    return 'done';
  }
  @OnSSEConnection()
  async onsseconnection(@Request() req: any, @Response() res: any) {
    console.log('onsseconnection------------');
    return req.body;
  }
  @OnSSEError()
  async onsseerror(@Request() req: any, @Response() res: any) {
    console.log('onsseerror------------');
    return req.body;
  }
  @OnSSEClose()
  async onsseclose(@Request() req: any, @Response() res: any) {
    console.log('onsseclose------------');
    return req.body;
  }
}
