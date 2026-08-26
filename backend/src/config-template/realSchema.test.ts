import { describe, expect, it } from "vitest";
import { validateConfig } from "../validation/validateConfig.js";
import { generateConfigTemplate } from "./generateConfigTemplate.js";

const realSchemaPath = process.env.MEF_REAL_SCHEMA_PATH;

/**
 * Opt-in regression check against the real (not committed — internal,
 * see proposal.md) MEF config schema. Run locally or in a private CI
 * with:
 *   MEF_REAL_SCHEMA_PATH=/path/to/mef-config-schema.json npm test
 * Skipped (not failed) when the env var is unset, so `npm test` stays
 * green and self-contained for everyone else. Mirrors
 * validation/realSchema.test.ts's and schema-info/realSchema.test.ts's
 * pattern.
 */
const REAL_SCHEMA_TIMEOUT_MS = 20_000;

describe.skipIf(!realSchemaPath)("generateConfigTemplate against the real MEF schema", () => {
  it(
    "generates a minimal template that validates with zero errors",
    async () => {
      const config = await generateConfigTemplate(realSchemaPath as string);
      const errors = await validateConfig(realSchemaPath as string, config);

      expect(errors).toEqual([]);
    },
    REAL_SCHEMA_TIMEOUT_MS,
  );

  it(
    "applies an override to a generated required field",
    async () => {
      const config = await generateConfigTemplate(realSchemaPath as string, {
        "/applications/0/name": "my-custom-app",
      });

      const applications = config.applications as Record<string, unknown>[];
      expect(applications[0]?.name).toBe("my-custom-app");
    },
    REAL_SCHEMA_TIMEOUT_MS,
  );
});
