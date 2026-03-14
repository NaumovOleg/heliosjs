import { ILResponse } from '@types';
import { ServerResponse } from 'http';

export class LResponse implements ILResponse {
  private _statusCode: number = 200;
  private _headers: Record<string, string> = {};
  body: any = null;

  constructor(private originalResponse?: ServerResponse) {}

  setHeader(name: string, value: string): void {
    this._headers[name] = value;
    if (this.originalResponse) {
      this.originalResponse.setHeader(name, value);
    }
  }

  set statusCode(code: number) {
    this._statusCode = code;
    if (this.originalResponse) {
      this.originalResponse.statusCode = code;
    }
  }

  get statusCode(): number {
    return this._statusCode;
  }

  get headers(): Record<string, string> {
    return { ...this._headers };
  }

  send(): void {
    throw `Lambda response doesn't have "send" method`;
  }

  get original(): ServerResponse | undefined {
    return this.originalResponse;
  }
}
