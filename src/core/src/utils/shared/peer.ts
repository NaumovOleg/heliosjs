/**
 * @internal Lazily `require()`s an optional peer dependency the first time
 * the returned getter is called, caching it after that. Not exported from
 * `@heliosjs/core/utils` — used by `validate.ts` (ajv, class-validator,
 * class-transformer) and `sanitize.ts` (joi) so those libraries are only
 * loaded — and only need to be installed — by apps that actually use the
 * feature backed by them. A synchronous `require()` rather than a dynamic
 * `import()` on purpose: every call site here (`compileSchema().from()`,
 * `validate()`'s class branch, every `SANITIZER.*` helper) is already
 * either synchronous or safely awaited, and this keeps it that way instead
 * of pushing `async`/`await` onto callers.
 */
export function lazyPeer<T>(name: string, feature: string): () => T {
  let mod: T | undefined;

  return () => {
    if (!mod) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        mod = require(name) as T;
      } catch {
        throw new Error(
          `${feature} needs the optional '${name}' peer dependency — install it: npm install ${name}`
        );
      }
    }
    return mod;
  };
}
