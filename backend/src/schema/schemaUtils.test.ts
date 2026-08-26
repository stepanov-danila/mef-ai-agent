import { describe, expect, it } from "vitest";
import { collapseFirstBranch, isPlainObject } from "./schemaUtils.js";

describe("isPlainObject", () => {
  it("is true for plain objects", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it("is false for arrays, null, and primitives", () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject("x")).toBe(false);
    expect(isPlainObject(1)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
  });
});

describe("collapseFirstBranch", () => {
  it("collapses a top-level oneOf to its first branch", () => {
    const schema = {
      oneOf: [{ type: "string" }, { type: "number" }],
    };

    expect(collapseFirstBranch(schema)).toEqual({ type: "string" });
  });

  it("collapses a nested anyOf inside properties", () => {
    const schema = {
      type: "object",
      properties: {
        modelType: {
          anyOf: [{ enum: ["PythonModel"] }, { enum: ["JavaModel"] }],
        },
      },
    };

    expect(collapseFirstBranch(schema)).toEqual({
      type: "object",
      properties: {
        modelType: { enum: ["PythonModel"] },
      },
    });
  });

  it("returns a schema with neither keyword unchanged", () => {
    const schema = {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    };

    expect(collapseFirstBranch(schema)).toEqual(schema);
  });

  it("does not mutate the input schema", () => {
    const branches = [{ type: "string" }, { type: "number" }];
    const schema = { oneOf: branches };

    collapseFirstBranch(schema);

    expect(schema.oneOf).toBe(branches);
    expect(schema.oneOf).toHaveLength(2);
  });
});
