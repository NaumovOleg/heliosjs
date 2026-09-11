# Stability & Versioning Policy

What "breaking change," "supported," and "stable" mean for the five
published `@heliosjs/*` packages. For release *mechanics* (Changesets,
`yarn changeset`, what CI runs on publish), see `CLAUDE.md`'s "Releasing"
section instead — this doc is about the guarantees, not the tooling.

## Versioning

Strict [semver](https://semver.org/), evaluated **independently per
package** — a breaking change in one package does not force a version bump
in another, even one that depends on it:

- `@heliosjs/core` and `@heliosjs/grpc` version independently of everything
  else and of each other.
- `@heliosjs/http`, `@heliosjs/aws`, and `@heliosjs/middlewares` are
  version-linked to each other (they bump together), but still independently
  of `core`/`grpc`.

Concretely: a major bump in `core` does **not** automatically trigger a
major bump in `http`/`aws`/`middlewares`, even though they depend on it.
If a `core` change actually breaks one of them, that breakage gets its own
changeset and its own semver bump in that package, evaluated on its own
merits — not a synchronized "everything moves together" policy.

## What counts as a breaking change

Anything a consumer can observe through a package's declared public entry
points (`@heliosjs/core`, `@heliosjs/core/utils`, `@heliosjs/core/types`,
`@heliosjs/core/constants`, and the equivalent subpaths for the other
packages — see each package's `exports` field): decorator signatures,
exported classes/functions/types, and documented runtime behavior
(request pipeline order, error codes, defaults).

**Not covered — no semver guarantee:** anything tagged `@internal` in its
JSDoc. That tag is this codebase's existing convention for "exported for
cross-package wiring, not public API" (see the JSDoc pass that added it
project-wide) — it can change or move in a patch release. If you're
depending on something tagged `@internal`, that's the risk you're taking.

## Support window

Only the current major of each package gets fixes — security or otherwise.
No backport commitment to older majors. This is a small/solo-maintained
project; promising multi-major support would be a promise this repo isn't
staffed to keep. Upgrade to the current major to get fixes.

## Experimental surface

None. Everything documented as part of the public API — including GraphQL
and WebSocket support in `@heliosjs/http`, both called out as optional
*features* in `CLAUDE.md` — carries the same stability guarantee as
everything else. "Optional" (you choose whether to enable it) is not the
same thing as "experimental" (it can break without a major bump); nothing
in this repo is the second kind right now. If that ever changes for a
specific surface, it'll be called out explicitly here and in that feature's
own docs — silence means stable.
