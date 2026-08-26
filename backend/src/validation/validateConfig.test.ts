import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv-draft-04";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetSchemaCacheForTests } from "../schema/loadSchema.js";
import {
  __resetValidatorCacheForTests,
  validateConfig,
} from "./validateConfig.js";

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "validation-schema.json",
);

beforeEach(() => {
  __resetSchemaCacheForTests();
  __resetValidatorCacheForTests();
});

describe("validateConfig", () => {
  it("returns no errors for a fully valid config", async () => {
    const errors = await validateConfig(schemaPath, {
      modelName: "my-model",
      modelType: "PythonModel",
      replicas: 2,
      runtime: { kind: "python" },
    });

    expect(errors).toEqual([]);
  });

  it("reports a missing required field with its path", async () => {
    const errors = await validateConfig(schemaPath, {
      modelType: "PythonModel",
    });

    expect(errors).toContainEqual(
      expect.objectContaining({ path: "/modelName" }),
    );
  });

  it("reports a wrong-pattern field with its path and reason", async () => {
    const errors = await validateConfig(schemaPath, {
      modelName: "Invalid Name!",
      modelType: "PythonModel",
    });

    const modelNameError = errors.find((e) => e.path === "/modelName");
    expect(modelNameError).toBeDefined();
    expect(modelNameError?.message).toMatch(/pattern/i);
  });

  it("reports one error per violation for multiple simultaneous violations", async () => {
    const errors = await validateConfig(schemaPath, {
      modelName: "Invalid Name!",
      replicas: "not-a-number",
    });

    const paths = errors.map((e) => e.path);
    expect(paths).toContain("/modelName");
    expect(paths).toContain("/replicas");
    expect(paths).toContain("/modelType");
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it("validates oneOf against the first branch only", async () => {
    const matchesFirstBranch = await validateConfig(schemaPath, {
      modelName: "my-model",
      modelType: "PythonModel",
      runtime: { kind: "python" },
    });
    expect(matchesFirstBranch).toEqual([]);

    const matchesOnlyLaterBranch = await validateConfig(schemaPath, {
      modelName: "my-model",
      modelType: "PythonModel",
      runtime: { kind: "java" },
    });
    expect(matchesOnlyLaterBranch).toContainEqual(
      expect.objectContaining({ path: "/runtime/kind" }),
    );
  });

  it("compiles the validator only once across multiple calls", async () => {
    const compileSpy = vi.spyOn(Ajv.prototype, "compile");

    await validateConfig(schemaPath, {
      modelName: "a",
      modelType: "PythonModel",
    });
    await validateConfig(schemaPath, {
      modelName: "b",
      modelType: "PythonModel",
    });

    expect(compileSpy).toHaveBeenCalledTimes(1);
    compileSpy.mockRestore();
  });
});
