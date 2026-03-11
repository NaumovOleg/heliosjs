import { IsString } from 'class-validator';

import {
  Body,
  Controller,
  CORS,
  Headers,
  InjectWS,
  IWebSocketService,
  Params,
  PUT,
  Query,
  Request,
  Response,
  Status,
  USE,
  Use,
} from 'quantum-flow/core';

import { UserMetadata } from './userMetadata';

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
@CORS({ origin: '*' })
@Use(() => {})
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
}
