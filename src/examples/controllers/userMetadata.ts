import { IsString } from 'class-validator';
import { Controller, GET, Params } from 'quantum-flow/core';

class DTO {
  constructor() {}
  @IsString()
  meta: string;
}

@Controller({ prefix: 'metadata' })
export class UserMetadata {
  @GET('/:meta')
  async getUserMetadata(@Params(DTO, 'meta') params: any) {
    throw 'dddaaaad';
  }
}
