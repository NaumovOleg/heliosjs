import { IsString } from 'class-validator';

import {
  Body,
  Controller,
  GET,
  Headers,
  InjectWS,
  PUT,
  Query,
  Request,
  Response,
  Status,
  USE,
} from 'quantum-flow/core';

class DTO {
  constructor() {}
  @IsString()
  name: string;
}

@Controller({ prefix: 'metadata' })
export class UserMetadata {
  @Status(201)
  @GET('/meta')
  async createUser(
    @Body(DTO) body: DTO,
    @Query() query: any,
    @Headers() headers: any,
    @InjectWS() ws: any,
    @Response() resp: any,
    @Request() req: any,
  ) {
    return 'METATADA RETURNED';
  }
  @Status(201)
  @PUT('/')
  async pay(
    @Body(DTO) body: DTO,
    @Query() query: any,
    @Headers() headers: any,
    @InjectWS() ws: any,
    @Response() resp: any,
    @Request() req: any,
  ) {
    throw 'metadata error';
  }
  @Status(201)
  @USE()
  async use(
    @Body(DTO) body: DTO,
    @Query() query: any,
    @Headers() headers: any,
    @InjectWS() ws: any,
    @Response() resp: any,
    @Request() req: any,
  ) {
    return 'metadata use';
  }
}
