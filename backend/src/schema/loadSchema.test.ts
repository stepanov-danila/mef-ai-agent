import { beforeEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { __resetSchemaCacheForTests, getSchema } from "./loadSchema.js";

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
);

beforeEach(() => {
  __resetSchemaCacheForTests();
  vi.mocked(readFile).mockClear();
});

describe("getSchema", () => {
  it("loads and fully dereferences a schema with internal $ref entries", async () => {
    const schema = (await getSchema(
      path.join(fixturesDir, "valid-schema.json"),
    )) as {
      properties: { modelType: { enum: string[] } };
    };

    expect(JSON.stringify(schema)).not.toContain("$ref");
    expect(schema.properties.modelType.enum).toContain("PythonModel");
  });

  it("throws a descriptive error when the schema file is missing", async () => {
    await expect(
      getSchema(path.join(fixturesDir, "does-not-exist.json")),
    ).rejects.toThrow(/Failed to read MEF schema file/);
  });

  it("throws a descriptive error when the schema file is not valid JSON", async () => {
    await expect(
      getSchema(path.join(fixturesDir, "invalid-json.json")),
    ).rejects.toThrow(/not valid JSON/);
  });

  it("throws a descriptive error when a $ref cannot be resolved", async () => {
    await expect(
      getSchema(path.join(fixturesDir, "unresolvable-ref.json")),
    ).rejects.toThrow(/Failed to resolve \$ref/);
  });

  it("caches the resolved schema and only reads the file once", async () => {
    const schemaPath = path.join(fixturesDir, "valid-schema.json");

    await getSchema(schemaPath);
    await getSchema(schemaPath);

    expect(vi.mocked(readFile)).toHaveBeenCalledTimes(1);
  });
});
