/**
 * Shared AI helpers — every LLM call in the app routes through this file.
 *
 * Rule: all model traffic must go through the Vercel AI Gateway via the AI SDK.
 * Do not add direct provider SDKs (OpenAI, Anthropic, etc.) elsewhere.
 *
 * Configure `AI_GATEWAY_API_KEY` (server-only) in env. Models are referenced
 * by gateway model id strings such as `openai/gpt-4.1-mini`.
 */
import { gateway } from "@ai-sdk/gateway";

export const DEFAULT_FAST_MODEL = "openai/gpt-4.1-mini";
export const DEFAULT_HEAVY_MODEL = "openai/gpt-4.1";

/**
 * Returns a gateway model handle for the given gateway model id.
 * The gateway provider reads `AI_GATEWAY_API_KEY` from the environment.
 */
export function model(modelId: string = DEFAULT_FAST_MODEL) {
  return gateway(modelId);
}

/**
 * Coarse server-side guard: do not invoke AI helpers when the key is missing
 * so callers fail fast with a clear error in dev and production.
 */
export function assertAiConfigured() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error(
      "AI_GATEWAY_API_KEY is not set. Set it in your environment to enable AI features.",
    );
  }
}
