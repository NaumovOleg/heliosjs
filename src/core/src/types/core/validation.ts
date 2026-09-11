/**
 * A DTO (data transfer object) accepted by `@Body`, `@QueryParam`, `@Params`,
 * `@Headers`, `@Cookies`, `@Files`. Either:
 * - a class decorated with `class-validator` decorators (`@IsString`, `@IsInt`,
 *   …) — the framework instantiates it via `class-transformer` and validates
 *   before the handler runs, or
 * - anything with a static/own `from(data)`, e.g. {@link compileSchema}'s
 *   result — called directly, no class-transformer involved.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Dto = (new (...args: any[]) => any) | { from: (data: unknown) => unknown };
