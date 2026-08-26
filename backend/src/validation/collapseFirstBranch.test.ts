import { describe, expect, it } from "vitest";
import { collapseFirstBranch } from "./collapseFirstBranch.js";

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
