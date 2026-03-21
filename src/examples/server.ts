import { Helios } from '@heliosjs/http';
import { App } from './app';

const server = new Helios(App);
server.listen().catch(console.error);
