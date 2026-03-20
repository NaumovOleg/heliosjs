import { LambdaAdapter } from 'quantum-flow/aws';
import { ANY, Controller, Request } from 'quantum-flow/core';
import { Plugin } from 'quantum-flow/plugins/aws';

@Controller({ prefix: 'metric' })
export class MetricsController {
  @ANY()
  async any(@Request() resp: any) {}
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
