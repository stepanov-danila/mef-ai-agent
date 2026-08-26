import { describe, expect, it, vi } from "vitest";
import { ScriptedProvider } from "./ScriptedProvider.js";
import { runAgentTurn } from "./runAgentTurn.js";
import type { AgentTool, ChatMessage, LLMProvider } from "./types.js";

function echoTool(name: string): AgentTool {
  return {
    definition: { name, description: `echoes its args as ${name}`, parameters: { type: "object" } },
    execute: vi.fn(async (args: unknown) => ({ received: args })),
  };
}

function throwingTool(name: string): AgentTool {
  return {
    definition: { name, description: `always throws as ${name}`, parameters: { type: "object" } },
    execute: vi.fn(async () => {
      throw new Error(`${name} exploded`);
    }),
  };
}

const userMessage: ChatMessage = { role: "user", content: "hi" };

describe("runAgentTurn", () => {
  it("returns immediately when the provider requests no tool calls", async () => {
    const provider = new ScriptedProvider([{ content: "final answer", toolCalls: [] }]);
    const completeSpy = vi.spyOn(provider, "complete");

    const result = await runAgentTurn([userMessage], {
      systemPrompt: "be helpful",
      tools: [],
      provider,
    });

    expect(result[result.length - 1]).toEqual({ role: "assistant", content: "final answer" });
    expect(completeSpy).toHaveBeenCalledTimes(1);
  });

  it("executes a single requested tool call and feeds its result back", async () => {
    const tool = echoTool("echo");
    const provider = new ScriptedProvider([
      { content: null, toolCalls: [{ id: "call-1", name: "echo", arguments: { x: 1 } }] },
      { content: "done", toolCalls: [] },
    ]);
    const completeSpy = vi.spyOn(provider, "complete");

    const result = await runAgentTurn([userMessage], {
      systemPrompt: "be helpful",
      tools: [tool],
      provider,
    });

    expect(tool.execute).toHaveBeenCalledWith({ x: 1 });
    expect(completeSpy).toHaveBeenCalledTimes(2);

    const toolMessage = result.find((m) => m.role === "tool");
    expect(toolMessage).toEqual({
      role: "tool",
      toolCallId: "call-1",
      name: "echo",
      content: JSON.stringify({ received: { x: 1 } }),
    });
    expect(result[result.length - 1]).toEqual({ role: "assistant", content: "done" });
  });

  it("executes multiple rounds of tool calls before the final answer", async () => {
    const toolA = echoTool("toolA");
    const toolB = echoTool("toolB");
    const provider = new ScriptedProvider([
      { content: null, toolCalls: [{ id: "1", name: "toolA", arguments: {} }] },
      { content: null, toolCalls: [{ id: "2", name: "toolB", arguments: {} }] },
      { content: "final", toolCalls: [] },
    ]);
    const completeSpy = vi.spyOn(provider, "complete");

    const result = await runAgentTurn([userMessage], {
      systemPrompt: "be helpful",
      tools: [toolA, toolB],
      provider,
    });

    expect(completeSpy).toHaveBeenCalledTimes(3);
    expect(toolA.execute).toHaveBeenCalledTimes(1);
    expect(toolB.execute).toHaveBeenCalledTimes(1);
    expect(result.filter((m) => m.role === "tool")).toHaveLength(2);
    expect(result[result.length - 1]).toEqual({ role: "assistant", content: "final" });
  });

  it("feeds back an error result for an unrecognized tool name and continues the loop", async () => {
    const provider = new ScriptedProvider([
      { content: null, toolCalls: [{ id: "1", name: "does_not_exist", arguments: {} }] },
      { content: "recovered", toolCalls: [] },
    ]);
    const completeSpy = vi.spyOn(provider, "complete");

    const result = await runAgentTurn([userMessage], {
      systemPrompt: "be helpful",
      tools: [],
      provider,
    });

    expect(completeSpy).toHaveBeenCalledTimes(2);
    const toolMessage = result.find((m) => m.role === "tool");
    expect(toolMessage?.content).toMatch(/does_not_exist/);
    expect(result[result.length - 1]).toEqual({ role: "assistant", content: "recovered" });
  });

  it("feeds back an error result when a tool throws and continues the loop", async () => {
    const tool = throwingTool("boom");
    const provider = new ScriptedProvider([
      { content: null, toolCalls: [{ id: "1", name: "boom", arguments: {} }] },
      { content: "recovered", toolCalls: [] },
    ]);

    const result = await runAgentTurn([userMessage], {
      systemPrompt: "be helpful",
      tools: [tool],
      provider,
    });

    const toolMessage = result.find((m) => m.role === "tool");
    expect(toolMessage?.content).toMatch(/boom exploded/);
    expect(result[result.length - 1]).toEqual({ role: "assistant", content: "recovered" });
  });

  it("stops after maxIterations rounds even if the provider keeps requesting tool calls", async () => {
    const tool = echoTool("echo");
    const maxIterations = 3;
    const responses = Array.from({ length: maxIterations }, (_, i) => ({
      content: null,
      toolCalls: [{ id: String(i), name: "echo", arguments: {} }],
    }));
    const provider = new ScriptedProvider(responses);
    const completeSpy = vi.spyOn(provider, "complete");

    const result = await runAgentTurn([userMessage], {
      systemPrompt: "be helpful",
      tools: [tool],
      provider,
      maxIterations,
    });

    expect(completeSpy).toHaveBeenCalledTimes(maxIterations);
    expect(result.filter((m) => m.role === "tool")).toHaveLength(maxIterations);
  });
});
