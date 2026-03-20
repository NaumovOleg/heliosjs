import { IsString } from 'class-validator';

import {
  ANY,
  Body,
  Controller,
  Headers,
  IWebSocketService,
  Params,
  PUT,
  Query,
  Request,
  Response,
} from 'quantum-flow/core';

import { Status } from 'quantum-flow/middlewares';
import { OnSSEClose, OnSSEConnection, OnSSEError } from 'quantum-flow/sse';
import { InjectWS } from 'quantum-flow/ws';

import { UserMetadata } from './userMetadata';

class DTO {
  constructor() {}
  @IsString()
  id: string;
}

@Controller({
  prefix: 'user',
  controllers: [UserMetadata],
  interceptor: (data, req, res) => {
    return { data, intercepted: true };
  },
})
export class User {
  @Status(201)
  @PUT(':id')
  async createUser(
    @Body() body: DTO,
    @Query() query: any,
    @Headers() headers: any,
    @InjectWS() ws: IWebSocketService,
    @Request() req: any,
    @Params(DTO, 'id') params: any,
    @Response() resp: any,
  ) {
    return { body, query, headers, params };
  }

  @Status(300)
  @ANY()
  async any(@Response() resp: any) {
    return 'done';
  }
  @OnSSEConnection()
  async onsseconnection(@Request() req: any, @Response() res: any) {
    return req.body;
  }
  @OnSSEError()
  async onsseerror(@Request() req: any, @Response() res: any) {
    return req.body;
  }
  @OnSSEClose()
  async onsseclose(@Request() req: any, @Response() res: any) {
    return req.body;
  }
}
