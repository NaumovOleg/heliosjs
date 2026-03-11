import { IsString } from 'class-validator';
import * as Joi from 'joi';
import { Body, Controller, GET, Multipart, Params, POST } from 'quantum-flow/core';
import { Cors, Sanitize, Use } from 'quantum-flow/middlewares';

class DTO {
  @IsString()
  name: string;
}
const userSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
});

@Controller({
  prefix: 'metadata',
  middlewares: [function s2() {}],
})
@Use([function s3() {}])
@Cors({ origin: '*' })
export class UserMetadata {
  @GET('/:meta')
  async getUserMetadata(@Params(DTO, 'meta') params: any) {
    return params;
  }

  @POST('/:meta', [function s4() {}])
  @Sanitize({
    schema: userSchema,
    action: 'both',
    options: { abortEarly: false },
    stripUnknown: true,
    type: 'body',
  })
  async createMeta(@Multipart() mult: any, @Body(DTO) body: any, @Params('meta') params: any) {
    return { body, params };
  }
}
