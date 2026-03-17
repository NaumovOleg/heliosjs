import { IsString } from 'class-validator';
import * as Joi from 'joi';
import {
  Body,
  Controller,
  Files,
  GET,
  IWebSocketService,
  Params,
  POST,
  Request,
  Response,
} from 'quantum-flow/core';
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
    throw new Error('errorororororo');
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

  @POST('/:meta')
  createMeta(
    @Files() mult: any,
    @Body(DTO) body: any,
    @Params('meta') params: any,
    @InjectWS() ws: IWebSocketService,
  ) {}
}
