import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { __resetSchemaCacheForTests } from "../schema/loadSchema.js";
import { getFieldInfo, listFields, parsePointer } from "./getSchemaInfo.js";

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "schema-info-schema.json",
);

beforeEach(() => {
  __resetSchemaCacheForTests();
});

describe("parsePointer", () => {
  it("splits a pointer into unescaped segments", () => {
    expect(parsePointer("/modelName")).toEqual(["modelName"]);
    expect(parsePointer("/runtime/kind")).toEqual(["runtime", "kind"]);
  });

  it("unescapes ~1 and ~0", () => {
    expect(parsePointer("/metadata~1regInfo")).toEqual(["metadata/regInfo"]);
    expect(parsePointer("/a~0b")).toEqual(["a~b"]);
  });

  it("returns undefined for a pointer not starting with /", () => {
    expect(parsePointer("modelName")).toBeUndefined();
  });

  it("returns an empty array for the root pointer", () => {
    expect(parsePointer("")).toEqual([]);
  });
});

describe("getFieldInfo", () => {
  it("resolves an existing top-level field", async () => {
    const info = await getFieldInfo(schemaPath, "/modelName");

    expect(info).toEqual({
      path: "/modelName",
      type: "string",
      required: true,
      constraints: { pattern: "^[a-z0-9-]+$" },
      description: "Name of the model, used to derive resource names",
    });
  });

  it("returns an empty constraints object for a field with only a type", async () => {
    const info = await getFieldInfo(schemaPath, "/notes");

    expect(info).toEqual({
      path: "/notes",
      type: "string",
      required: false,
      constraints: {},
    });
  });

  it("marks a field not listed in its parent's required array as not required", async () => {
    const info = await getFieldInfo(schemaPath, "/replicas");

    expect(info?.required).toBe(false);
    expect(info?.constraints).toEqual({ minimum: 1 });
  });

  it("does not include the description in constraints", async () => {
    const info = await getFieldInfo(schemaPath, "/modelName");

    expect(info?.constraints).not.toHaveProperty("description");
  });

  it("returns undefined for a field path that does not exist in the schema", async () => {
    const info = await getFieldInfo(schemaPath, "/doesNotExist");

    expect(info).toBeUndefined();
  });

  it("returns undefined for a nested path that does not exist", async () => {
    const info = await getFieldInfo(schemaPath, "/runtime/doesNotExist");

    expect(info).toBeUndefined();
  });

  it("returns undefined for a malformed or empty pointer", async () => {
    expect(await getFieldInfo(schemaPath, "modelName")).toBeUndefined();
    expect(await getFieldInfo(schemaPath, "")).toBeUndefined();
  });

  it("reports a field whose own schema is a union as variants, not a merged type", async () => {
    const info = await getFieldInfo(schemaPath, "/runtime/kind");

    expect(info?.type).toBeUndefined();
    expect(info?.variants).toEqual([
      { discriminator: undefined, required: [], type: "string", constraints: { enum: ["python"] } },
      { discriminator: undefined, required: [], type: "string", constraints: { enum: ["java"] } },
    ]);
  });
});

describe("listFields", () => {
  it("lists every top-level field with correct required flags", async () => {
    const fields = await listFields(schemaPath);
    const byPath = Object.fromEntries(fields.map((f) => [f.path, f]));

    expect(Object.keys(byPath).sort()).toEqual(
      ["/modelName", "/modelType", "/notes", "/replicas", "/runtime"].sort(),
    );
    expect(byPath["/modelName"]?.required).toBe(true);
    expect(byPath["/modelType"]?.required).toBe(true);
    expect(byPath["/replicas"]?.required).toBe(false);
    expect(byPath["/notes"]?.required).toBe(false);
  });

  it("lists the fields nested under a given pointer", async () => {
    const fields = await listFields(schemaPath, "/runtime");

    expect(fields.map((f) => f.path)).toEqual(["/runtime/kind"]);
  });

  it("returns an empty list for a pointer that does not resolve", async () => {
    expect(await listFields(schemaPath, "/doesNotExist")).toEqual([]);
  });
});
