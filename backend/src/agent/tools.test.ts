import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { __resetSchemaCacheForTests } from "../schema/loadSchema.js";
import { __resetValidatorCacheForTests } from "../validation/validateConfig.js";
import { createAgentTools } from "./tools.js";

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "schema",
  "__fixtures__",
  "valid-schema.json",
);

beforeEach(() => {
  __resetSchemaCacheForTests();
  __resetValidatorCacheForTests();
});

function toolNamed(name: string) {
  const tool = createAgentTools(schemaPath).find((t) => t.definition.name === name);
  if (!tool) throw new Error(`No tool named ${name}`);
  return tool;
}

describe("createAgentTools", () => {
  it("returns exactly the three MEF agent tools with descriptions and parameter schemas", () => {
    const tools = createAgentTools(schemaPath);

    expect(tools.map((t) => t.definition.name).sort()).toEqual(
      ["generate_config_template", "get_schema_info", "validate_mef_config"].sort(),
    );
    for (const tool of tools) {
      expect(tool.definition.description.length).toBeGreaterThan(0);
      expect(tool.definition.parameters).toEqual(expect.objectContaining({ type: "object" }));
    }
  });
});

describe("validate_mef_config tool", () => {
  it("returns validation errors for a valid config", async () => {
    const result = await toolNamed("validate_mef_config").execute({
      config: { modelName: "my-model", modelType: "PythonModel" },
    });
    expect(result).toEqual({ errors: [] });
  });

  it("throws when the 'config' argument is missing", async () => {
    await expect(toolNamed("validate_mef_config").execute({})).rejects.toThrow(/config/);
  });
});

describe("get_schema_info tool", () => {
  it("resolves a field's metadata when a pointer is given", async () => {
    const result = (await toolNamed("get_schema_info").execute({ pointer: "/modelName" })) as {
      field?: { path: string };
      fields: unknown[];
    };
    expect(result.field?.path).toBe("/modelName");
  });

  it("lists top-level fields when no pointer is given", async () => {
    const result = (await toolNamed("get_schema_info").execute({})) as {
      field?: unknown;
      fields: { path: string }[];
    };
    expect(result.field).toBeUndefined();
    expect(result.fields.map((f) => f.path).sort()).toEqual(
      ["/modelName", "/modelType", "/runtime"].sort(),
    );
  });

  it("throws when 'pointer' is not a string", async () => {
    await expect(toolNamed("get_schema_info").execute({ pointer: 42 })).rejects.toThrow(/pointer/);
  });
});

describe("generate_config_template tool", () => {
  it("generates a template with no args", async () => {
    const config = (await toolNamed("generate_config_template").execute(undefined)) as Record<
      string,
      unknown
    >;
    expect(config.modelName).toEqual(expect.any(String));
  });

  it("applies overrides", async () => {
    const config = (await toolNamed("generate_config_template").execute({
      overrides: { "/modelName": "custom-model" },
    })) as Record<string, unknown>;
    expect(config.modelName).toBe("custom-model");
  });

  it("throws when 'overrides' is not an object", async () => {
    await expect(
      toolNamed("generate_config_template").execute({ overrides: "nope" }),
    ).rejects.toThrow(/overrides/);
  });
});
