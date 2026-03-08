// simple-import-sort/imports: off
import 'reflect-metadata';
import { IsString } from 'class-validator';

import {
  Body,
  Controller,
  Headers,
  InjectWS,
  Query,
  Response,
  Status,
  USE,
} from 'quantum-flow/core';
import { Intercept } from 'quantum-flow/http';

class DTO {
  constructor() {}
  @IsString()
  name: string;
}

@Controller({
  prefix: 'user',
})
@Intercept(() => {
  console.log('user interceptor');
  return 'intercepted';
})
export class User {
  @Status(300)
  @USE('/:nane')
  async test(
    @Body(DTO) body: any,
    @Query() query: any,
    @Headers() headers: any,
    @InjectWS() ws: any,
    @Response() resp: any,
  ) {
    console.log(resp.setHeader);
    resp.setHeader('Set-Cookie', ['token=; Path=/; Max-Age=0', 'userId=; Path=/; Max-Age=0']);
    return 'Test';
  }
}
