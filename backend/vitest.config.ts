import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    env: {
      // The `config` module-level singleton reads MEF_SCHEMA_PATH at import
      // time, so any test file that transitively imports it (e.g. app.ts,
      // index.ts) needs it set even when the test itself doesn't care about
      // schema loading. src/index.test.ts overrides this per-subprocess.
      MEF_SCHEMA_PATH: path.join(
        dirname,
        "src/schema/__fixtures__/valid-schema.json",
      ),
    },
  },
});
