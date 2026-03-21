import { IsString } from 'class-validator';

import { ANY, Body, Controller, Headers, Params, PUT, Query, Response } from '@heliosjs/core';

import {
  InjectWS,
  IWebSocketService,
  OnSSEClose,
  OnSSEConnection,
  OnSSEError,
} from '@heliosjs/http';
import { Status } from '@heliosjs/middlewares';

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
    @Req() req: any,
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
  async onsseconnection(@Req() req: any, @Response() res: any) {
    return req.body;
  }
  @OnSSEError()
  async onsseerror(@Req() req: any, @Response() res: any) {
    return req.body;
  }
  @OnSSEClose()
  async onsseclose(@Req() req: any, @Response() res: any) {
    return req.body;
  }
}
