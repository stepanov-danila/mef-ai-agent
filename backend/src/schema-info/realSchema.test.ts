import { describe, expect, it } from "vitest";
import { getFieldInfo } from "./getSchemaInfo.js";

const realSchemaPath = process.env.MEF_REAL_SCHEMA_PATH;

/**
 * Opt-in regression check against the real (not committed — internal,
 * see proposal.md) MEF config schema. Run locally or in a private CI
 * with:
 *   MEF_REAL_SCHEMA_PATH=/path/to/mef-config-schema.json npm test
 * Skipped (not failed) when the env var is unset, so `npm test` stays
 * green and self-contained for everyone else. Mirrors
 * validation/realSchema.test.ts's pattern.
 */
describe.skipIf(!realSchemaPath)("getFieldInfo against the real MEF schema", () => {
  it("resolves a deep path through an array index, a discriminated union, several $ref hops, and patternProperties", async () => {
    const info = await getFieldInfo(
      realSchemaPath as string,
      "/applications/0/components/models/0/settings/resources/limits/cpu",
    );

    expect(info?.type).toBe("string");
    expect(info?.constraints.pattern).toBe("^[0-9]+m?$");
  });

  it("merges a discriminator field across every real applications branch, not just the first", async () => {
    const info = await getFieldInfo(realSchemaPath as string, "/applications/0/deployStrategy");

    expect(info?.constraints.enum).toEqual(
      expect.arrayContaining(["Apply", "Create", "Replace", "None", "Delete"]),
    );
    expect((info?.constraints.enum as unknown[]).length).toBe(5);
  });

  it("reports all 12 secretConfig variants for the required secrets field", async () => {
    const info = await getFieldInfo(realSchemaPath as string, "/secrets/0");

    expect(info?.variants).toHaveLength(12);
    expect(info?.variants?.map((v) => v.discriminator?.value)).toContain("Keytab");
  });
});
