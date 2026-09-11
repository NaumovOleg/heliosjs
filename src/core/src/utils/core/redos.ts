/**
 * Heuristic-only catastrophic-backtracking ("ReDoS") smell check for a
 * user-supplied inline route regex (the `pattern` in `:id(pattern)` —
 * developer-authored, unlike the framework's own generated segment
 * patterns, which are provably linear by construction — see
 * `compileRouteRegex` in `controller.ts`).
 *
 * Looks for the classic nested-repetition shape behind most real-world
 * ReDoS bugs: a quantified group whose own body can also repeat
 * (`(a+)+`, `(a*)*`, `(a+){2,}`, …). This is a static regex-on-a-regex
 * pattern match, not a real analysis of the regex engine's state machine —
 * it will miss some genuinely risky patterns (e.g. certain alternation-based
 * ones) and can flag some safe ones. It exists to nudge whoever wrote
 * `@Get(':id(...)')` toward a second look, not to gate route registration:
 * callers only warn on a hit, they never throw or refuse the route.
 *
 * @param pattern - The regex source from inside a route's `:name(pattern)`.
 * @returns `true` when `pattern` looks like it risks catastrophic backtracking.
 */
export function looksReDoSRisky(pattern: string): boolean {
  // A group `(...)` that itself contains a quantifier, immediately followed
  // by another quantifier on the group — e.g. `(a+)+`, `(a*)+`, `([a-z]+){2,}`.
  return /\([^()]*[+*][^()]*\)[+*]|\([^()]*[+*][^()]*\)\{\d*,?\d*\}/.test(pattern);
}
