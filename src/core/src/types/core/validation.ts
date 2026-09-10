/**
 * A DTO (data transfer object) class accepted by `@Body`, `@QueryParam`,
 * `@Params`, `@Headers`, `@Cookies`, `@Files`. Decorate its properties with
 * `class-validator` decorators (`@IsString`, `@IsInt`, …); the framework
 * instantiates it via `class-transformer` and validates before the handler runs.
 */
export type Dto = new (...args: any[]) => any;
