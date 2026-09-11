// utils/MultipartProcessor.ts
import * as multipart from 'parse-multipart-data';
import type { MultipartFile, Request } from '../../types/core';
import { mimeFromPath } from '../shared/mime';

/**
 * @internal Parses a `multipart/form-data` request body into text fields and
 * uploaded files. Backs the `@Files()` / `@Body()` param decorators; app code
 * reads the result through those instead of calling this directly.
 */
export class MultipartProcessor {
  /**
   * @param request - `headers`, `body`, and `isBase64Encoded` from a `Request`.
   * @returns `fields` (non-file form values, JSON-decoded when the value looks
   *   like an object/array) and `files` (one {@link MultipartFile}, or an array
   *   when the same field name repeats).
   * @throws {Error} When the body is not `multipart/form-data` or the boundary
   *   is missing/invalid.
   */
  static parse(request: Pick<Request, 'headers' | 'isBase64Encoded' | 'body'>): {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fields: Record<string, any>;
    files: Record<string, MultipartFile | MultipartFile[]>;
  } {
    const { body, headers, isBase64Encoded } = request;

    if (!body) {
      return { fields: {}, files: {} };
    }

    let contentType = headers['Content-Type'] ?? headers['content-type'] ?? '';
    if (Array.isArray(contentType)) {
      contentType = contentType[0];
    }

    if (!contentType.startsWith('multipart/form-data')) {
      throw new Error('Not a multipart request');
    }

    const boundaryMatch = multipart.getBoundary(contentType);
    if (!boundaryMatch) {
      throw new Error('Invalid multipart boundary');
    }

    let bodyBuffer: Buffer;
    if (Buffer.isBuffer(body)) {
      bodyBuffer = body;
    } else if (typeof body === 'string') {
      bodyBuffer = isBase64Encoded ? Buffer.from(body, 'base64') : Buffer.from(body, 'binary');
    } else {
      bodyBuffer = Buffer.from(JSON.stringify(body));
    }

    const parts = multipart.parse(bodyBuffer, boundaryMatch);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields: Record<string, any> = {};
    const files: Record<string, MultipartFile | MultipartFile[]> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parts.forEach((part: any) => {
      if (part.filename) {
        const fieldName = part.name || 'file';
        const contentType = this.getContentType(part);

        const fileData: MultipartFile = {
          fieldname: fieldName,
          filename: part.filename,
          contentType: contentType ?? part.type,
          data: part.data,
          size: part.data.length,
          encoding: part.encoding,
        };

        if (files[fieldName]) {
          if (Array.isArray(files[fieldName])) {
            (files[fieldName] as MultipartFile[]).push(fileData);
          } else {
            files[fieldName] = [files[fieldName] as MultipartFile, fileData];
          }
        } else {
          files[fieldName] = fileData;
        }
      } else if (part.name) {
        const text = part.data.toString('utf-8').trim();

        // Only decode JSON objects/arrays; scalars ("30", "true") stay strings.
        if (text.startsWith('{') || text.startsWith('[')) {
          try {
            fields[part.name] = JSON.parse(text);
          } catch {
            fields[part.name] = text;
          }
        } else {
          fields[part.name] = text;
        }
      }
    });

    return { fields, files };
  }

  /** `true` when the request's `Content-Type` is `multipart/form-data`. */
  static isMultipart(request: Request): boolean {
    let contentType = request.headers?.['Content-Type'] || request.headers?.['content-type'] || '';
    contentType = Array.isArray(contentType) ? contentType[0] : contentType;
    return contentType.startsWith('multipart/form-data');
  }

  private static getContentType(part: MultipartFile) {
    return mimeFromPath(part.filename || '');
  }
}
