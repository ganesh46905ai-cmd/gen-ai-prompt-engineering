import { createServerFn } from "@tanstack/react-start";
import type { ModelMessage } from "ai";

import { runGatewayText } from "./ai/gateway.server";

export interface PromptConfig {
  useCase: string;
  systemPrompt: string;
  fallbackPrompt: string;
  tone: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface EvalResult {
  score: number;
  relevance: number;
  clarity: number;
  toneMatch: number;
  feedback: string;
}

const FALLBACK_TRIGGER =
  "I don't have enough reliable information to answer that accurately";

function buildInstructions(config: PromptConfig): string {
  return [
    `You are the production assistant for this business use case: ${config.useCase}.`,
    "",
    "SYSTEM PROMPT (authoritative behavior specification written by the prompt engineer):",
    config.systemPrompt,
    "",
    `Tone requirement: ${config.tone}.`,
    "",
    "CONTEXT & MEMORY RULES:",
    "- Use the full conversation history to resolve references like \"it\", \"that\", or \"the last one\".",
    "- Never invent facts, prices, policies, or capabilities not implied by the system prompt.",
    "",
    "FALLBACK RULE:",
    `- If the request is outside the use case, or you cannot answer reliably, respond with the fallback behavior instead of guessing: ${config.fallbackPrompt}`,
    `- When you trigger the fallback, begin your reply with the exact marker "${FALLBACK_TRIGGER}" so the system can log it.`,
  ].join("\n");
}

async function evaluateAnswer(
  config: PromptConfig,
  question: string,
  answer: string,
): Promise<EvalResult | null> {
  try {
    const raw = await runGatewayText({
      instructions: [
        "You are a strict response-quality evaluator for a generative AI application.",
        "Score the assistant answer against the system prompt, tone requirement, and user question.",
        "Reply with ONLY a JSON object, no markdown, with exactly these keys:",
        '{"score": number 0-100, "relevance": number 0-10, "clarity": number 0-10, "toneMatch": number 0-10, "feedback": "one short sentence"}',
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            `Use case: ${config.useCase}`,
            `System prompt: ${config.systemPrompt}`,
            `Required tone: ${config.tone}`,
            `User question: ${question}`,
            `Assistant answer: ${answer}`,
          ].join("\n\n"),
        },
      ],
    });
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as EvalResult;
    if (typeof parsed.score !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export const sendMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      config: PromptConfig;
      history: ChatTurn[];
      message: string;
      conversationId?: string | undefined;
      promptVersionId?: string | undefined;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Conversation logging: create a conversation row on the first turn.
    let conversationId = data.conversationId;
    if (!conversationId) {
      const { data: convo, error } = await supabaseAdmin
        .from("conversations")
        .insert({
          title: data.message.slice(0, 60),
          prompt_version_id: data.promptVersionId ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      conversationId = convo.id;
    }

    await supabaseAdmin
      .from("messages")
      .insert({ conversation_id: conversationId, role: "user", content: data.message });

    const messages: ModelMessage[] = [
      ...data.history.map((turn) => ({ role: turn.role, content: turn.content }) as ModelMessage),
      { role: "user", content: data.message },
    ];

    const answer = await runGatewayText({
      instructions: buildInstructions(data.config),
      messages,
    });

    const usedFallback = answer.includes(FALLBACK_TRIGGER);
    const evaluation = usedFallback ? null : await evaluateAnswer(data.config, data.message, answer);

    await supabaseAdmin.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: answer,
      used_fallback: usedFallback,
      eval_score: evaluation?.score ?? null,
      eval_feedback: evaluation?.feedback ?? null,
    });

    return { conversationId, answer, usedFallback, evaluation };
  });

export const listPromptVersions = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("prompt_versions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
});

export const savePromptVersion = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string; config: PromptConfig }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("prompt_versions")
      .insert({
        name: data.name,
        use_case: data.config.useCase,
        system_prompt: data.config.systemPrompt,
        fallback_prompt: data.config.fallbackPrompt,
        tone: data.config.tone,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const loadConversation = createServerFn({ method: "POST" })
  .inputValidator((input: { conversationId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("messages")
      .select("role, content, used_fallback, eval_score, eval_feedback, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows;
  });
