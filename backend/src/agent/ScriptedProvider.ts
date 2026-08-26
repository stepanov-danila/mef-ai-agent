import type { ChatMessage, LLMProvider, LLMResponse, ToolDefinition } from "./types.js";

/**
 * A test-double `LLMProvider` that returns a pre-programmed sequence of
 * responses, one per `complete` call, in order. Ignores its `messages`/
 * `tools` arguments — assertions about what the loop sent the provider
 * belong in a spy at the call site, not in this double. Throws if
 * `complete` is called more times than there are scripted responses.
 */
export class ScriptedProvider implements LLMProvider {
  private readonly responses: LLMResponse[];
  private callCount = 0;

  constructor(responses: LLMResponse[]) {
    this.responses = responses;
  }

  async complete(_messages: ChatMessage[], _tools: ToolDefinition[]): Promise<LLMResponse> {
    if (this.callCount >= this.responses.length) {
      throw new Error(
        `ScriptedProvider.complete called ${this.callCount + 1} times but only ${this.responses.length} response(s) were scripted`,
      );
    }
    return this.responses[this.callCount++];
  }
}
