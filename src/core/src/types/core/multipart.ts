/** One uploaded file from a `multipart/form-data` body, as injected by `@Files()`. */
export interface MultipartFile {
  /** Form field name the file was uploaded under. */
  fieldname: string;
  /** Original filename supplied by the client. */
  filename: string;
  /** MIME type, guessed from the filename extension when the client didn't send one. */
  contentType: string;
  /** File contents. */
  data: Buffer;
  /** Size in bytes (`data.length`). */
  size: number;
  /** Content-Transfer-Encoding from the multipart part, when present. */
  encoding?: string;
}
