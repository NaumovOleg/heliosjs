import { IsString } from 'class-validator';

import {
  Body,
  Catch,
  Controller,
  Headers,
  InjectWS,
  PUT,
  Query,
  Request,
  Response,
  Status,
  USE,
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
  interceptor: (data, req, res) => {
    console.log('user interceptor');
    console.log('=============', res?.statusCode, req?.method);

    return data;
  },
})
@Catch((err) => {
  console.log('USER catched');
  return { status: 401, err };
})
export class User {
  @Status(201)
  @PUT('/:nane')
  async createUser(
    @Body(DTO) body: DTO,
    @Query() query: any,
    @Headers() headers: any,
    @InjectWS() ws: any,
    @Response() resp: any,
    @Request() req: any,
  ) {
    console.log('createUser');
    resp.setHeader('Set-Cookie', ['token=; Path=/; Max-Age=0', 'userId=; Path=/; Max-Age=0']);
    return {
      body,
      query,
      headers,
    };
  }

  @Status(300)
  @USE()
  async any(
    @Body(DTO) body: any,
    @Query() query: any,
    @Headers() headers: any,
    @InjectWS() ws: any,
    @Response() resp: any,
  ) {
    console.log('use');
    resp.setHeader('Set-Cookie', ['token=; Path=/; Max-Age=0', 'userId=; Path=/; Max-Age=0']);
    return 'Test';
  }
}
