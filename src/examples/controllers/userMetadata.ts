import { IsString } from 'class-validator';
import * as Joi from 'joi';
import {
  Body,
  Controller,
  GET,
  IWebSocketService,
  Multipart,
  Params,
  POST,
  Request,
  Response,
} from 'quantum-flow/core';
import { Sanitize } from 'quantum-flow/middlewares';
import { InjectSSE, ISSEService } from 'quantum-flow/sse';
import { InjectWS } from 'quantum-flow/ws';

class DTO {
  @IsString()
  name: string;
}
const userSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
});

@Controller({ prefix: 'metadata' })
export class UserMetadata {
  @GET('/:meta')
  async getUserMetadata(@Request() req: any, @Response() res: any) {
    return req.body;
  }

  @GET('/subscribesse')
  async subscribesse(@InjectSSE() sse: ISSEService, @Response() res: any) {
    const client = sse.createConnection(res);

    sse.sendToClient(client.id, {
      event: 'welcome message',
      data: { message: 'Connected to notifications' },
    });

    return 'hellow';
  }

  @POST('/:meta', [function s4() {}])
  @Sanitize({
    schema: userSchema,
    action: 'both',
    options: { abortEarly: false },
    stripUnknown: true,
    type: 'body',
  })
  async createMeta(
    @Multipart() mult: any,
    @Body(DTO) body: any,
    @Params('meta') params: any,
    @InjectWS() ws: IWebSocketService,
  ) {
    return { body, params };
  }
}
