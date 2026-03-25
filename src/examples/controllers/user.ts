import { IsString } from 'class-validator';

import { ANY, Body, Controller, Headers, Params, POST, Query, Req, Res } from '@heliosjs/core';

import {
  InjectWS,
  IWebSocketService,
  OnSSEClose,
  OnSSEConnection,
  OnSSEError,
} from '@heliosjs/http';
import { Catch, Status } from '@heliosjs/middlewares';

import { UserMetadata } from './userMetadata';

class DTO {
  constructor() {}
  @IsString()
  id: string;
}

@Controller({
  prefix: 'user',
  controllers: [UserMetadata],
})
@Catch((err) => {
  console.log('===========', err);
})
export class User {
  @Status(201)
  @POST(':id')
  async createUser(
    @Body() body: DTO,
    @Query() query: any,
    @Headers() headers: any,
    @InjectWS() ws: IWebSocketService,
    @Req() req: any,
    @Params('id') params: any,
    @Res() resp: any,
  ) {
    throw '{ body, query, headers, params }';
  }

  @Status(300)
  @ANY()
  async any(@Res() resp: any) {
    return 'done';
  }
  @OnSSEConnection()
  async onsseconnection(@Req() req: any, @Res() res: any) {
    return req.body;
  }
  @OnSSEError()
  async onsseerror(@Req() req: any, @Res() res: any) {
    return req.body;
  }
  @OnSSEClose()
  async onsseclose(@Req() req: any, @Res() res: any) {
    return req.body;
  }
}
