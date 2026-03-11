import { SanitizeXSS } from '@utils';
import { IsString } from 'class-validator';
import { Body, Controller, CORS, GET, Multipart, Params, POST, Use } from 'quantum-flow/core';

class DTO {
  @SanitizeXSS()
  @IsString()
  name: string;
}

@Controller({
  prefix: 'metadata',
  middlewares: [() => {}],
})
@Use([() => {}])
@CORS({ origin: '*' })
export class UserMetadata {
  @GET('/:meta')
  async getUserMetadata(@Params(DTO, 'meta') params: any) {
    return params;
  }

  @POST('/:meta')
  async createMeta(@Multipart() mult: any, @Body(DTO) body: any, @Params('meta') params: any) {
    return { body, params };
  }
}
