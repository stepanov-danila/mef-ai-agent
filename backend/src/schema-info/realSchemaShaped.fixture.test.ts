import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv-draft-04";
import { describe, expect, it } from "vitest";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "real-schema-shaped.json",
);

describe("real-schema-shaped.json fixture", () => {
  it("is valid JSON and conforms to the Draft-04 meta-schema", () => {
    const raw = readFileSync(fixturePath, "utf-8");
    const parsed = JSON.parse(raw);

    const ajv = new Ajv({ strict: false });
    const validateMeta = ajv.getSchema(
      "http://json-schema.org/draft-04/schema",
    );
    expect(validateMeta).toBeDefined();
    expect(validateMeta?.(parsed)).toBe(true);
  });
});
