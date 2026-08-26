import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { __resetSchemaCacheForTests } from "../schema/loadSchema.js";
import { getFieldInfo, listTopLevelFields } from "./getSchemaInfo.js";

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "schema-info-schema.json",
);

beforeEach(() => {
  __resetSchemaCacheForTests();
});

describe("getFieldInfo", () => {
  it("resolves an existing top-level field", async () => {
    const info = await getFieldInfo(schemaPath, "modelName");

    expect(info).toEqual({
      path: "modelName",
      type: "string",
      required: true,
      constraints: { pattern: "^[a-z0-9-]+$" },
    });
  });

  it("resolves an existing nested field, collapsing oneOf to the first branch", async () => {
    const info = await getFieldInfo(schemaPath, "runtime.kind");

    expect(info).toEqual({
      path: "runtime.kind",
      type: "string",
      required: true,
      constraints: { enum: ["python"] },
    });
  });

  it("returns an empty constraints object for a field with only a type", async () => {
    const info = await getFieldInfo(schemaPath, "notes");

    expect(info).toEqual({
      path: "notes",
      type: "string",
      required: false,
      constraints: {},
    });
  });

  it("marks a field not listed in its parent's required array as not required", async () => {
    const info = await getFieldInfo(schemaPath, "replicas");

    expect(info?.required).toBe(false);
    expect(info?.constraints).toEqual({ minimum: 1 });
  });

  it("only includes allowlisted constraint keywords, excluding e.g. description", async () => {
    const info = await getFieldInfo(schemaPath, "modelName");

    expect(info?.constraints).not.toHaveProperty("description");
  });

  it("returns undefined for a field path that does not exist in the schema", async () => {
    const info = await getFieldInfo(schemaPath, "doesNotExist");

    expect(info).toBeUndefined();
  });

  it("returns undefined for a nested path that does not exist", async () => {
    const info = await getFieldInfo(schemaPath, "runtime.doesNotExist");

    expect(info).toBeUndefined();
  });
});

describe("listTopLevelFields", () => {
  it("lists every top-level field with correct required flags", async () => {
    const fields = await listTopLevelFields(schemaPath);
    const byPath = Object.fromEntries(fields.map((f) => [f.path, f]));

    expect(Object.keys(byPath).sort()).toEqual(
      ["modelName", "modelType", "notes", "replicas", "runtime"].sort(),
    );
    expect(byPath.modelName?.required).toBe(true);
    expect(byPath.modelType?.required).toBe(true);
    expect(byPath.replicas?.required).toBe(false);
    expect(byPath.notes?.required).toBe(false);
  });
});
