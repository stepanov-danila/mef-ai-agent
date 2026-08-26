import { describe, expect, it } from "vitest";
import { ScriptedProvider } from "./ScriptedProvider.js";

describe("ScriptedProvider", () => {
  it("returns scripted responses in order", async () => {
    const provider = new ScriptedProvider([
      { content: null, toolCalls: [{ id: "1", name: "foo", arguments: {} }] },
      { content: "done", toolCalls: [] },
    ]);

    const first = await provider.complete([], []);
    expect(first.content).toBeNull();
    expect(first.toolCalls).toHaveLength(1);

    const second = await provider.complete([], []);
    expect(second.content).toBe("done");
  });

  it("throws when called more times than there are scripted responses", async () => {
    const provider = new ScriptedProvider([{ content: "only one", toolCalls: [] }]);

    await provider.complete([], []);
    await expect(provider.complete([], [])).rejects.toThrow(/scripted/);
  });
});
