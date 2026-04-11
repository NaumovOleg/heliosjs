export const parseCloudFrontHeaders = (headers?: {
  [name: string]: Array<{
    key?: string | undefined;
    value: string;
  }>;
}): Record<string, string | string[]> => {
  const result: Record<string, string | string[]> = {};

  if (!headers) return result;

  Object.entries(headers).forEach(([key, values]) => {
    if (values.length > 1) {
      result[key] = values.map(v => v.value);
    } else {
      result[key] = values[0]?.value || '';
    }
  });

  return result;
};
