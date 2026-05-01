export interface MultipartFile {
  fieldname: string;
  filename: string;
  contentType: string;
  data: Buffer;
  size: number;
  encoding?: string;
}
