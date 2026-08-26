import { describe, expect, it } from "vitest";
import { readConfig } from "./config.js";

describe("readConfig", () => {
  it("applies the default port when PORT is unset", () => {
    const config = readConfig({ MEF_SCHEMA_PATH: "/tmp/schema.json" });
    expect(config.port).toBe(3000);
    expect(config.mefSchemaPath).toBe("/tmp/schema.json");
  });

  it("uses PORT when set", () => {
    const config = readConfig({ PORT: "4321", MEF_SCHEMA_PATH: "/tmp/schema.json" });
    expect(config.port).toBe(4321);
  });

  it("throws when MEF_SCHEMA_PATH is unset", () => {
    expect(() => readConfig({})).toThrow(/MEF_SCHEMA_PATH/);
  });
});
