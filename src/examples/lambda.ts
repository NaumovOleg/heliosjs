import 'reflect-metadata';

import { LambdaAdapter, Plugin } from '@heliosjs/aws';
import { ANY, Controller } from '@heliosjs/core';

@Controller({ prefix: 'metric' })
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

const lambdaAdapter = new LambdaAdapter(MetricsController);
lambdaAdapter.usePlugin(metricsPlugin);

export const handler = lambdaAdapter.handler;
