import 'reflect-metadata';

import { Helios, Plugin } from '@heliosjs/aws';
import { ANY, Controller, Req } from '@heliosjs/core';

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

const lambdaAdapter = new Helios(MetricsController);
lambdaAdapter.usePlugin(metricsPlugin);

export const handler = lambdaAdapter.handler;
