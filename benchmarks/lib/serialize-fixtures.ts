// Shared, deterministic fixture data for the serialization suite
// (run-serialize.ts) — same generator, same output, across all four
// frameworks' servers, so what's being compared is serialization cost, not
// different payloads. No Math.random() — a fixed formula so every server
// process (and every run) produces byte-identical JSON.
function makeItem(i: number) {
  return {
    id: i,
    name: `widget-${i}`,
    price: Math.round((i * 1.37 + 5) * 100) / 100,
    inStock: i % 2 === 0,
    tags: [`tag${i % 5}`, `tag${(i + 1) % 5}`],
  };
}

/** Single ~5-field object — same shape as the routing suite's /users/:id. */
export const SMALL_PAYLOAD = makeItem(1);
/** 100-item array of the same shape. */
export const MEDIUM_PAYLOAD = Array.from({ length: 100 }, (_, i) => makeItem(i));
/** 2,000-item array of the same shape. */
export const LARGE_PAYLOAD = Array.from({ length: 2000 }, (_, i) => makeItem(i));

/** JSON Schema for one item — used by fastify-serialize.ts's response.schema. */
export const ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    price: { type: 'number' },
    inStock: { type: 'boolean' },
    tags: { type: 'array', items: { type: 'string' } },
  },
} as const;
