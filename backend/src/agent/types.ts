export type JSONSchemaObject = Record<string, unknown>;

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchemaObject;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  /** Present on an assistant message that requests tool calls. */
  toolCalls?: ToolCall[];
  /** Present on a tool-result message, referencing the call it answers. */
  toolCallId?: string;
  /** Present on a tool-result message, naming the tool that produced it. */
  name?: string;
}

export interface LLMResponse {
  content: string | null;
  toolCalls: ToolCall[];
}

export interface LLMProvider {
  complete(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LLMResponse>;
}

export interface AgentTool {
  definition: ToolDefinition;
  execute(args: unknown): Promise<unknown>;
}
