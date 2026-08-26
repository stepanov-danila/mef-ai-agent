import type { AgentTool, ChatMessage, LLMProvider, ToolCall } from "./types.js";

export interface RunAgentTurnOptions {
  systemPrompt: string;
  tools: AgentTool[];
  provider: LLMProvider;
  /** Maximum number of provider calls before the loop stops. Default: 5. */
  maxIterations?: number;
}

const DEFAULT_MAX_ITERATIONS = 5;

async function executeToolCall(call: ToolCall, tools: AgentTool[]): Promise<ChatMessage> {
  const tool = tools.find((t) => t.definition.name === call.name);
  let content: string;
  try {
    if (!tool) {
      throw new Error(`Unknown tool "${call.name}"`);
    }
    const result = await tool.execute(call.arguments);
    content = JSON.stringify(result);
  } catch (err) {
    content = JSON.stringify({ error: (err as Error).message });
  }
  return { role: "tool", content, toolCallId: call.id, name: call.name };
}

/**
 * Calls `options.provider` with `messages` (prefixed with a system
 * message built from `options.systemPrompt`) and `options.tools`'
 * definitions, executing every tool call the provider's response
 * requests via the matching `AgentTool` and feeding each result back as
 * a tool-result message, repeating until a response requests no further
 * tool calls or `options.maxIterations` rounds have run. A tool call
 * that fails (unknown tool name, invalid arguments, or a thrown error)
 * produces an error tool-result message instead of aborting the loop.
 * Returns the full conversation, including the prepended system message.
 */
export async function runAgentTurn(
  messages: ChatMessage[],
  options: RunAgentTurnOptions,
): Promise<ChatMessage[]> {
  const { systemPrompt, tools, provider, maxIterations = DEFAULT_MAX_ITERATIONS } = options;
  const toolDefinitions = tools.map((tool) => tool.definition);

  let conversation: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...messages];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const response = await provider.complete(conversation, toolDefinitions);
    const assistantMessage: ChatMessage = {
      role: "assistant",
      content: response.content,
      ...(response.toolCalls.length > 0 ? { toolCalls: response.toolCalls } : {}),
    };
    conversation = [...conversation, assistantMessage];

    if (response.toolCalls.length === 0) {
      return conversation;
    }

    for (const call of response.toolCalls) {
      conversation = [...conversation, await executeToolCall(call, tools)];
    }
  }

  return conversation;
}
