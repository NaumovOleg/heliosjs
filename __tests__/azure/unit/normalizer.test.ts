import { describe, expect, it } from 'vitest';
import { HttpRequest, InvocationContext } from '@azure/functions';
import { normalizeAzureRequest } from '../../../src/azure/src/utils/azure/request.normalizer';

const ctx = new InvocationContext({ functionName: 'fn', invocationId: 'inv-1' });

describe('normalizeAzureRequest', () => {
  it('parses method, url, path and requestId', async () => {
    const req = new HttpRequest({ method: 'GET', url: 'https://fn.azurewebsites.net/api/users/1' });
    const options = await normalizeAzureRequest(req, ctx);
    expect(options.method).toBe('GET');
    expect(options.path).toBe('/api/users/1');
    expect(options.requestId).toBe('inv-1');
    expect(options.source).toBe('azure');
  });

  it('flattens repeated query params into arrays', async () => {
    const req = new HttpRequest({
      method: 'GET',
      url: 'https://fn.azurewebsites.net/api/x?tag=a&tag=b&page=1',
    });
    const options = await normalizeAzureRequest(req, ctx);
    expect(options.query.tag).toEqual(['a', 'b']);
    expect(options.query.page).toBe('1');
  });

  it('copies route params', async () => {
    const req = new HttpRequest({
      method: 'GET',
      url: 'https://fn.azurewebsites.net/api/users/42',
      params: { id: '42' },
    });
    const options = await normalizeAzureRequest(req, ctx);
    expect(options.params).toEqual({ id: '42' });
  });

  it('parses the Cookie header', async () => {
    const req = new HttpRequest({
      method: 'GET',
      url: 'https://fn.azurewebsites.net/api/x',
      headers: { cookie: 'session=abc123; theme=dark' },
    });
    const options = await normalizeAzureRequest(req, ctx);
    expect(options.cookies).toEqual({ session: 'abc123', theme: 'dark' });
  });

  it('parses a JSON body', async () => {
    const req = new HttpRequest({
      method: 'POST',
      url: 'https://fn.azurewebsites.net/api/x',
      headers: { 'content-type': 'application/json' },
      body: { string: JSON.stringify({ name: 'John' }) },
    });
    const options = await normalizeAzureRequest(req, ctx);
    expect(options.body).toEqual({ name: 'John' });
  });

  it('throws on malformed JSON body', async () => {
    const req = new HttpRequest({
      method: 'POST',
      url: 'https://fn.azurewebsites.net/api/x',
      headers: { 'content-type': 'application/json' },
      body: { string: '{not json' },
    });
    await expect(normalizeAzureRequest(req, ctx)).rejects.toThrow();
  });

  it('leaves body undefined when empty', async () => {
    const req = new HttpRequest({ method: 'GET', url: 'https://fn.azurewebsites.net/api/x' });
    const options = await normalizeAzureRequest(req, ctx);
    expect(options.body).toBeUndefined();
  });

  it('extracts sourceIp from x-forwarded-for, stripping the port', async () => {
    const req = new HttpRequest({
      method: 'GET',
      url: 'https://fn.azurewebsites.net/api/x',
      headers: { 'x-forwarded-for': '1.2.3.4:5555' },
    });
    const options = await normalizeAzureRequest(req, ctx);
    expect(options.sourceIp).toBe('1.2.3.4');
  });

  it('takes the right-most (trusted) hop when x-forwarded-for has multiple', async () => {
    const req = new HttpRequest({
      method: 'GET',
      url: 'https://fn.azurewebsites.net/api/x',
      headers: { 'x-forwarded-for': '1.1.1.1:1, 2.2.2.2:2' },
    });
    const options = await normalizeAzureRequest(req, ctx);
    expect(options.sourceIp).toBe('2.2.2.2');
  });

  it('leaves sourceIp undefined without x-forwarded-for', async () => {
    const req = new HttpRequest({ method: 'GET', url: 'https://fn.azurewebsites.net/api/x' });
    const options = await normalizeAzureRequest(req, ctx);
    expect(options.sourceIp).toBeUndefined();
  });

  it('reads the User-Agent header', async () => {
    const req = new HttpRequest({
      method: 'GET',
      url: 'https://fn.azurewebsites.net/api/x',
      headers: { 'user-agent': 'vitest' },
    });
    const options = await normalizeAzureRequest(req, ctx);
    expect(options.userAgent).toBe('vitest');
  });

  it('keeps the raw HttpRequest as event/raw and the InvocationContext as context', async () => {
    const req = new HttpRequest({ method: 'GET', url: 'https://fn.azurewebsites.net/api/x' });
    const options = await normalizeAzureRequest(req, ctx);
    expect(options.event).toBe(req);
    expect(options.context).toBe(ctx);
  });
});
