export async function transformAndValidate(dtoClass: any, data: any) {
  if (!dtoClass) return data;

  if (typeof dtoClass.from === 'function') {
    return dtoClass.from(data);
  }
  if (typeof dtoClass === 'function') {
    const instance = new dtoClass();
    Object.entries(data).forEach(([key, val]) => {
      instance[key] = val;
    });

    Object.assign(instance, data);
    if (typeof instance.validate === 'function') {
      await instance.validate();
    }

    return instance;
  }

  return data;
}
