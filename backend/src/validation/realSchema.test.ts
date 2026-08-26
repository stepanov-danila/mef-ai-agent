import { describe, expect, it } from "vitest";
import { validateConfig } from "./validateConfig.js";

const realSchemaPath = process.env.MEF_REAL_SCHEMA_PATH;

/**
 * Opt-in regression check against the real (not committed — internal,
 * see proposal.md) MEF config schema. Run locally or in a private CI
 * with:
 *   MEF_REAL_SCHEMA_PATH=/path/to/mef-config-schema.json npm test
 * Skipped (not failed) when the env var is unset, so `npm test` stays
 * green and self-contained for everyone else.
 */
// Ajv compiling the full real schema (strict:false, ~600 $ref, many
// patternProperties) takes a few seconds — well above vitest's default
// per-test timeout, so these need an explicit budget.
const REAL_SCHEMA_TIMEOUT_MS = 20_000;

describe.skipIf(!realSchemaPath)("validateConfig against the real MEF schema", () => {
  it(
    "accepts a minimal config using a non-first branch of a discriminated union",
    async () => {
      const errors = await validateConfig(realSchemaPath as string, {
        pipelineParameters: { vaultNamespace: "ci12345678" },
        credentials: { vaultCred: "somecred" },
        secrets: [],
        applications: [{ name: "myapp", deployStrategy: "None" }],
      });

      expect(errors).toEqual([]);
    },
    REAL_SCHEMA_TIMEOUT_MS,
  );

  it(
    "reports a small, specific error list for a config with genuine mistakes",
    async () => {
      const errors = await validateConfig(realSchemaPath as string, {
        pipelineParameters: { vaultNamespace: "ci12345678" },
        credentials: { vaultCred: "somecred" },
        secrets: [],
        applications: [{ name: "MyApp!!", deployStrategy: "Create" }],
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.length).toBeLessThanOrEqual(3);
      expect(
        errors.every((e) => !/exactly one schema/i.test(e.message)),
      ).toBe(true);
    },
    REAL_SCHEMA_TIMEOUT_MS,
  );
});
