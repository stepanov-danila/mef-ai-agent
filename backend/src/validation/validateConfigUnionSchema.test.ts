import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { __resetSchemaCacheForTests } from "../schema/loadSchema.js";
import { __resetValidatorCacheForTests, validateConfig } from "./validateConfig.js";

const schemaPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "union-schema.json",
);

beforeEach(() => {
  __resetSchemaCacheForTests();
  __resetValidatorCacheForTests();
});

const validSecretConfig = {
  name: "s",
  valueType: "Keytab",
  valueFrom: { vaultSecretRef: { path: "p" } },
};

describe("validateConfig against union-schema.json (real-schema-shaped fixture)", () => {
  it("compiles successfully despite a node with an unrecognized keyword outside properties", async () => {
    const errors = await validateConfig(schemaPath, {
      applications: [{ name: "a", deployStrategy: "Delete" }],
      secretConfig: validSecretConfig,
    });

    expect(errors).toEqual([]);
  });

  it("validates a config using a non-first discriminated branch with zero errors", async () => {
    const errors = await validateConfig(schemaPath, {
      applications: [
        { name: "a", deployStrategy: "Update", targetVersion: "1.2.3" },
      ],
      secretConfig: validSecretConfig,
    });

    expect(errors).toEqual([]);
  });

  it("attributes errors from 2 genuine mistakes to exactly those 2, not every branch's failures", async () => {
    const errors = await validateConfig(schemaPath, {
      // Missing "image", required by the "Create" branch it discriminates to.
      applications: [{ name: "a", deployStrategy: "Create" }],
      // "name" has the wrong type, in the "Keytab" branch it discriminates to.
      secretConfig: {
        name: 123,
        valueType: "Keytab",
        valueFrom: { vaultSecretRef: { path: "p" } },
      },
    });

    expect(errors).toHaveLength(2);
    const paths = errors.map((e) => e.path).sort();
    expect(paths).toEqual(["/applications/0/image", "/secretConfig/name"]);
    expect(errors.every((e) => !/exactly one schema/i.test(e.message))).toBe(
      true,
    );
  });
});
