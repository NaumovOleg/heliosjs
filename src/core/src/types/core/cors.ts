/**
 * Cross-Origin Resource Sharing policy, accepted by the `@Cors` decorator and the
 * `@Server({ cors })` / `Helios(ctrl, { cors })` global config. See `@Cors` for
 * full field-by-field explanation and defaults.
 */
export interface CORSConfig {
  /** Allowed origin(s): `'*'`, an exact list, or a predicate `(origin) => boolean`. */
  origin?: string | string[] | ((origin: string) => boolean);
  /** Methods advertised via `Access-Control-Allow-Methods`. */
  methods?: string[];
  /** Request headers the browser may send (`Access-Control-Allow-Headers`). */
  allowedHeaders?: string[];
  /** Response headers JS may read (`Access-Control-Expose-Headers`). */
  exposedHeaders?: string[];
  /** Send `Access-Control-Allow-Credentials: true` (cookies / `Authorization`). Incompatible with `origin: '*'`. */
  credentials?: boolean;
  /** Seconds a browser may cache the preflight result. */
  maxAge?: number;
  /** Status code for a successful preflight response. */
  optionsSuccessStatus?: number;
}
