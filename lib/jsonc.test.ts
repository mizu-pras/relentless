import assert from "assert";

import { parseJsonc } from "./jsonc.js";

function pass(message: string): void {
  console.log(`PASS: ${message}`);
}

try {
  const lineComment = parseJsonc(`{
    // remove this comment
    "name": "relentless"
  }`) as Record<string, unknown>;
  assert.strictEqual(lineComment.name, "relentless");
  pass("parseJsonc strips line comments outside strings");

  const blockComment = parseJsonc(`{
    /* remove this block */
    "mode": "strict"
  }`) as Record<string, unknown>;
  assert.strictEqual(blockComment.mode, "strict");
  pass("parseJsonc strips block comments outside strings");

  const trailingCommas = parseJsonc(`{
    "items": [1, 2,],
    "nested": {
      "ok": true,
    },
  }`) as Record<string, unknown>;
  assert.deepStrictEqual(trailingCommas.items, [1, 2]);
  assert.deepStrictEqual(trailingCommas.nested, { ok: true });
  pass("parseJsonc removes trailing commas before braces and brackets");

  const urlValue = parseJsonc(`{
    "url": "https://example.com/docs"
  }`) as Record<string, unknown>;
  assert.strictEqual(urlValue.url, "https://example.com/docs");
  pass("parseJsonc preserves URLs inside strings");

  const slashValue = parseJsonc(`{
    "note": "see // docs for details"
  }`) as Record<string, unknown>;
  assert.strictEqual(slashValue.note, "see // docs for details");
  pass("parseJsonc preserves double slash sequences inside strings");

  const mixed = parseJsonc(`{
    // remove this comment
    "url": "https://example.com",
    "note": "see // docs",
    /* and this block */
    "enabled": true,
  }`) as Record<string, unknown>;
  assert.strictEqual(mixed.url, "https://example.com");
  assert.strictEqual(mixed.note, "see // docs");
  assert.strictEqual(mixed.enabled, true);
  pass("parseJsonc handles mixed comments and string literals");

  const escapedQuotes = parseJsonc(`{
    "value": "say \\\"hello\\\""
  }`) as Record<string, unknown>;
  assert.strictEqual(escapedQuotes.value, 'say "hello"');
  pass("parseJsonc handles escaped quotes in strings");

  assert.throws(() => parseJsonc('{"broken": }'), /.+/);
  pass("parseJsonc throws on invalid JSON");

  const empty = parseJsonc("{}") as Record<string, unknown>;
  assert.deepStrictEqual(empty, {});
  pass("parseJsonc parses empty objects");

  const nested = parseJsonc(`{
    "outer": {
      // comment in nested object
      "inner": [
        {
          "name": "entry"
        },
      ],
    },
  }`) as Record<string, unknown>;
  assert.deepStrictEqual(nested.outer, {
    inner: [
      {
        name: "entry",
      },
    ],
  });
  pass("parseJsonc parses nested structures with comments");

  console.log("All jsonc tests passed.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
