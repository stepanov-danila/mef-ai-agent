import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { __resetSchemaCacheForTests } from "../schema/loadSchema.js";
import { __resetValidatorCacheForTests, validateConfig } from "../validation/validateConfig.js";
import { generateConfigTemplate } from "./generateConfigTemplate.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const generateSchemaPath = path.join(fixturesDir, "generate-schema.json");
const unionSchemaPath = path.join(fixturesDir, "union-schema.json");
const realShapedUnionSchemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "validation",
  "__fixtures__",
  "union-schema.json",
);

beforeEach(() => {
  __resetSchemaCacheForTests();
  __resetValidatorCacheForTests();
});

describe("generateConfigTemplate: required-field walk", () => {
  it("includes every required field, including nested required sub-fields, and omits optional fields", async () => {
    const config = await generateConfigTemplate(generateSchemaPath);

    expect(Object.keys(config).sort()).toEqual(
      ["contactEmail", "containers", "modelName", "modelType", "replicas", "runtime"].sort(),
    );
    expect(config.notes).toBeUndefined();

    expect(config.runtime).toEqual(expect.objectContaining({ kind: expect.any(String) }));
  });
});

describe("generateConfigTemplate: scalar placeholders", () => {
  it("picks the first enum value", async () => {
    const config = await generateConfigTemplate(generateSchemaPath);
    expect(config.modelType).toBe("PythonModel");
  });

  it("produces a string matching a declared pattern", async () => {
    const config = await generateConfigTemplate(generateSchemaPath);
    expect(config.modelName).toMatch(/^[a-z0-9-]+$/);
  });

  it("uses the format placeholder table for a known format", async () => {
    const config = await generateConfigTemplate(generateSchemaPath);
    expect(config.contactEmail).toBe("user@example.com");
  });

  it("produces a number within the declared minimum/maximum range", async () => {
    const config = await generateConfigTemplate(generateSchemaPath);
    expect(config.replicas).toBeGreaterThanOrEqual(1);
    expect(config.replicas).toBeLessThanOrEqual(10);
  });
});

describe("generateConfigTemplate: array generation", () => {
  it("generates at least minItems elements, each satisfying the item schema", async () => {
    const config = await generateConfigTemplate(generateSchemaPath);
    const containers = config.containers as Record<string, unknown>[];

    expect(containers.length).toBeGreaterThanOrEqual(2);
    for (const item of containers) {
      expect(item.name).toEqual(expect.any(String));
    }
  });
});

describe("generateConfigTemplate: union branch selection", () => {
  it("defaults to the first branch when no override selects otherwise", async () => {
    const config = await generateConfigTemplate(unionSchemaPath);
    const deployment = config.deployment as Record<string, unknown>;

    expect(deployment.strategy).toBe("Create");
    expect(deployment.image).toEqual(expect.any(String));
    expect(deployment.targetVersion).toBeUndefined();
  });

  it("selects a non-first branch when an override targets its discriminator", async () => {
    const config = await generateConfigTemplate(unionSchemaPath, {
      "/deployment/strategy": "Update",
    });
    const deployment = config.deployment as Record<string, unknown>;

    expect(deployment.strategy).toBe("Update");
    expect(deployment.targetVersion).toEqual(expect.any(String));
    expect(deployment.image).toBeUndefined();
  });
});

describe("generateConfigTemplate: field-value overrides", () => {
  it("applies an override on a generated required field", async () => {
    const config = await generateConfigTemplate(generateSchemaPath, {
      "/modelName": "my-custom-model",
    });
    expect(config.modelName).toBe("my-custom-model");
  });

  it("is a no-op for an override targeting a field the minimal template omitted", async () => {
    const withOverride = await generateConfigTemplate(generateSchemaPath, {
      "/notes": "should not appear",
    });
    const withoutOverride = await generateConfigTemplate(generateSchemaPath);

    expect(withOverride).toEqual(withoutOverride);
    expect(withOverride.notes).toBeUndefined();
  });

  it("generates the same template with no overrides argument as with an empty object", async () => {
    const noArg = await generateConfigTemplate(generateSchemaPath);
    __resetSchemaCacheForTests();
    const emptyOverrides = await generateConfigTemplate(generateSchemaPath, {});

    expect(noArg).toEqual(emptyOverrides);
  });
});

describe("generateConfigTemplate: agrees with validateConfig", () => {
  it("generates a template from a realistic multi-branch schema that validates with zero errors", async () => {
    const config = await generateConfigTemplate(realShapedUnionSchemaPath);
    const errors = await validateConfig(realShapedUnionSchemaPath, config);
    expect(errors).toEqual([]);
  });
});
