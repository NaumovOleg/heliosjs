import type http from 'node:http';
import { PayloadTooLargeError } from '@heliosjs/core/utils';

/** Default maximum request body size: 1 MB. */
export const DEFAULT_BODY_LIMIT = 1_048_576;

/**
 * Read the full request body as a Buffer, enforcing a maximum size.
 *
 * @param maxBytes Maximum allowed body size in bytes. Defaults to
 *   DEFAULT_BODY_LIMIT. A value of `0` or `Infinity` disables the limit.
 */
export const collectRawBody = (
  req: http.IncomingMessage,
  maxBytes: number = DEFAULT_BODY_LIMIT,
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const limited = maxBytes > 0 && Number.isFinite(maxBytes);
    let done = false;

    const fail = (err: Error) => {
      if (done) return;
      done = true;
      req.destroy();
      reject(err);
    };

    if (limited) {
      const declared = Number(req.headers['content-length']);
      if (Number.isFinite(declared) && declared > maxBytes) {
        return fail(new PayloadTooLargeError());
      }
    }

    const chunks: Buffer[] = [];
    let received = 0;

    req.on('data', (chunk: Buffer) => {
      if (done) return;
      received += chunk.length;
      if (limited && received > maxBytes) {
        return fail(new PayloadTooLargeError());
      }
      chunks.push(Buffer.from(chunk));
    });

    req.on('end', () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks));
    });

    req.on('error', (err) => {
      if (done) return;
      done = true;
      reject(err);
    });
  });
};
