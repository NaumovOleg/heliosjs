import 'reflect-metadata';

import { Helios, Plugin } from '@heliosjs/aws';
import { ANY, Controller, Req } from '@heliosjs/core';
import { User } from './controllers';

@Controller({ prefix: '/api', controllers: [User] })
export class MetricsController {
  @ANY()
  async any(@Req() resp: any) {}
}

export const metricsPlugin: Plugin = {
  name: 'metric',
  onInit: (server) => {
    server.controllers.push(MetricsController);
  },
  hooks: {
    beforeRoute: (req, res) => {},
  },
};

const lambdaAdapter = new Helios(MetricsController);
lambdaAdapter.usePlugin(metricsPlugin);

export const handler = lambdaAdapter.handler;

import { context } from './mock/context';
import event from './mock/lambda_api_gateway_rest.json';

const y = async () => {
  const resp = await handler(event, context, () => {});
  console.log(resp);
};

y();
