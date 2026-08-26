import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { __resetSchemaCacheForTests } from "../schema/loadSchema.js";
import { getFieldInfo, listFields } from "./getSchemaInfo.js";

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "real-schema-shaped.json",
);

beforeEach(() => {
  __resetSchemaCacheForTests();
});

describe("getFieldInfo against real-schema-shaped.json", () => {
  it("resolves a field inside an array element (numeric segment into items)", async () => {
    const info = await getFieldInfo(schemaPath, "/applications/0/name");

    expect(info?.type).toBe("string");
    expect(info?.required).toBe(true);
  });

  it("resolves a field via a patternProperties match", async () => {
    const info = await getFieldInfo(schemaPath, "/labels/anything");

    expect(info?.type).toBe("string");
  });

  it("includes description from a merged union branch", async () => {
    const info = await getFieldInfo(schemaPath, "/applications/0/name");

    expect(info?.description).toBe("Application name");
  });

  it("includes item constraints for an array of enum-constrained scalars", async () => {
    const info = await getFieldInfo(schemaPath, "/pipelineParameters/goals");

    expect(info?.type).toBe("array");
    expect(info?.constraints).toEqual({ minItems: 1 });
    expect(info?.items?.constraints.enum).toEqual(["Sonar", "Deploy", "Test"]);
  });

  it("REGRESSION: merges a discriminator field across every branch when descending through a union, not just branch 0", async () => {
    const info = await getFieldInfo(schemaPath, "/applications/0/deployStrategy");

    expect(info?.constraints.enum).toEqual(["Create", "Update", "Delete"]);
  });

  it("resolves a path exactly to a union node as raw (unmerged), reporting all variants", async () => {
    const info = await getFieldInfo(schemaPath, "/applications/0");

    expect(info?.type).toBe("object");
    expect(info?.variants).toHaveLength(3);
    expect(info?.variants?.map((v) => v.discriminator)).toEqual([
      { property: "deployStrategy", value: "Create" },
      { property: "deployStrategy", value: "Update" },
      { property: "deployStrategy", value: "Delete" },
    ]);
    expect(info?.variants?.[0].required).toEqual(["name", "deployStrategy", "image"]);
  });

  it("reports variants of a non-discriminated union (distinguished only by which property is required)", async () => {
    const info = await getFieldInfo(schemaPath, "/credentials");

    expect(info?.variants).toEqual([
      { discriminator: undefined, required: ["vaultSecretRef"], type: undefined, constraints: {} },
      { discriminator: undefined, required: ["vaultADSecretRef"], type: undefined, constraints: {} },
    ]);
  });
});

describe("listFields against real-schema-shaped.json", () => {
  it("lists the union of every branch's fields when pointing at an array element", async () => {
    const fields = await listFields(schemaPath, "/applications/0");
    const paths = fields.map((f) => f.path).sort();

    expect(paths).toEqual(
      [
        "/applications/0/name",
        "/applications/0/deployStrategy",
        "/applications/0/image",
        "/applications/0/targetVersion",
      ].sort(),
    );
  });
});
