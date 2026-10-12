import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

import { createLovableAiGatewayRunIdFetch } from "./run-id.ts";

const GATEWAY_BASE_URL = "https://ai.gateway.lovable.dev/v1";
const DEFAULT_MODEL = "openai/gpt-6-astra";

/**
 * Runs a streamed Responses call through the Lovable AI Gateway and returns
 * the final accumulated text. The provider and run-ID fetch wrapper are
 * created per request; LOVABLE_API_KEY stays server-side.
 */
export async function runGatewayText(options: {
  instructions: string;
  messages: ModelMessage[];
  model?: string;
}): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    throw new Error("AI is not configured for this app yet.");
  }

  const model = options.model ?? DEFAULT_MODEL;
  const runIdFetch = createLovableAiGatewayRunIdFetch(undefined);
  const provider = createOpenAI({
    baseURL: GATEWAY_BASE_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(model),
    instructions: options.instructions,
    messages: options.messages,
    maxRetries: 0,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const text = await result.text;
  if (!text.trim()) {
    throw new Error("The AI returned an empty response. Please try again.");
  }
  return text;
}
