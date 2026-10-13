import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";

import {
  listPromptVersions,
  savePromptVersion,
  sendMessage,
  type ChatTurn,
  type EvalResult,
  type PromptConfig,
} from "@/lib/studio.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PromptForge Studio — End-to-End Generative AI App" },
      {
        name: "description",
        content:
          "Build, test and evaluate production-style AI prompts with memory, versioning, fallback handling and automatic quality scoring.",
      },
      { property: "og:title", content: "PromptForge Studio — End-to-End Generative AI App" },
      {
        property: "og:description",
        content:
          "Prompt architecture, context memory, prompt versions and AI response scoring in one studio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

type Msg = ChatTurn & { usedFallback?: boolean; evaluation?: EvalResult | null; sources?: string[] };

const PRESETS: Record<string, PromptConfig> = {
  "Customer Support": {
    useCase: "Customer support for 'NovaBank', a digital banking app",
    systemPrompt:
      "You are NovaBank's support assistant. Help users with account access, card blocking, transfers, and app features. Give numbered steps when explaining procedures. Never ask for passwords, PINs or OTPs. For fraud, tell users to block their card in-app and call 1800-000-111.",
    fallbackPrompt:
      "Politely say you can't help with that and offer to connect the user to a human agent.",
    tone: "friendly and reassuring",
    knowledge:
      "Debit card replacement arrives in 5-7 business days, free of charge.\nUPI transfer limit is Rs 1,00,000 per day.\nNEFT transfers settle within 2 hours on working days.\nApp login issues: update the app, clear cache, then reset via 'Forgot password'.\nSavings account interest rate is 3.5% per year.",
  },
  "HR Policy Assistant": {
    useCase: "Internal HR policy Q&A for employees of a mid-size IT company",
    systemPrompt:
      "You answer employee questions on leave, work-from-home, payroll dates and benefits. Policy: 24 paid leaves/year, 3 WFH days/week, salary credited on the last working day. Keep answers under 120 words.",
    fallbackPrompt: "Advise the employee to email hr@company.com for anything not covered.",
    tone: "professional and concise",
    knowledge:
      "Maternity leave is 26 weeks paid.\nPaternity leave is 10 working days.\nHealth insurance covers employee, spouse and 2 children up to Rs 5 lakh.\nLeave requests are submitted on the HRMS portal 3 days in advance.",
  },
  "Course Advisor": {
    useCase: "Learning-path advisor for an online tech education platform",
    systemPrompt:
      "Recommend courses in Python, Data Science, Web Development and Generative AI based on the learner's background and goal. Always explain WHY each course fits, and suggest an order.",
    fallbackPrompt: "Explain that you only advise on the platform's tech courses.",
    tone: "encouraging mentor",
    knowledge:
      "Python Foundations: 6 weeks, beginner, no prerequisites.\nData Science with Pandas: 8 weeks, requires Python Foundations.\nFull-Stack Web Dev: 12 weeks, HTML/CSS/JS/React.\nGenerative AI & Prompt Engineering: 6 weeks, requires basic Python.",
  },
};

function Studio() {
  const send = useServerFn(sendMessage);
  const listVersions = useServerFn(listPromptVersions);
  const saveVersion = useServerFn(savePromptVersion);

  const [config, setConfig] = useState<PromptConfig>(PRESETS["Customer Support"]!);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [versions, setVersions] = useState<Awaited<ReturnType<typeof listPromptVersions>>>([]);
  const [activeVersionId, setActiveVersionId] = useState<string>();
  const [tab, setTab] = useState<"prompt" | "chat" | "metrics">("chat");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listVersions().then(setVersions).catch(() => {});
  }, [listVersions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const scored = messages.filter((m) => m.evaluation);
  const avg = (k: keyof EvalResult) =>
    scored.length
      ? Math.round(
          scored.reduce((s, m) => s + Number(m.evaluation![k]), 0) / scored.length *
            (k === "score" ? 1 : 10),
        ) / (k === "score" ? 1 : 10)
      : 0;
  const fallbacks = messages.filter((m) => m.usedFallback).length;

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await send({
        data: { config, history, message: text, conversationId, promptVersionId: activeVersionId },
      });
      setConversationId(res.conversationId);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.answer,
          usedFallback: res.usedFallback,
          evaluation: res.evaluation,
          sources: res.sources,
        },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveVersion() {
    const name = `v${versions.length + 1} · ${config.useCase.slice(0, 28)}`;
    try {
      const row = await saveVersion({ data: { name, config } });
      setVersions((v) => [row, ...v]);
      setActiveVersionId(row.id);
      toast.success(`Saved ${name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  function loadVersion(id: string) {
    const v = versions.find((x) => x.id === id);
    if (!v) return;
    setConfig({
      useCase: v.use_case,
      systemPrompt: v.system_prompt,
      fallbackPrompt: v.fallback_prompt,
      tone: v.tone,
      knowledge: config.knowledge,
    });
    setActiveVersionId(v.id);
    resetChat();
    toast.success(`Loaded ${v.name}`);
  }

  function resetChat() {
    setMessages([]);
    setConversationId(undefined);
  }

  const promptPanel = (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {Object.keys(PRESETS).map((k) => (
          <button
            key={k}
            onClick={() => {
              setConfig(PRESETS[k]!);
              setActiveVersionId(undefined);
              resetChat();
            }}
            className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground transition hover:border-primary hover:text-primary"
          >
            {k}
          </button>
        ))}
      </div>
      <Field label="Business use case">
        <input
          value={config.useCase}
          onChange={(e) => setConfig({ ...config, useCase: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </Field>
      <Field label="System prompt">
        <textarea
          rows={7}
          value={config.systemPrompt}
          onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-primary"
        />
      </Field>
      <Field label="Fallback behaviour">
        <textarea
          rows={2}
          value={config.fallbackPrompt}
          onChange={(e) => setConfig({ ...config, fallbackPrompt: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
        />
      </Field>
      <Field label="Tone">
        <input
          value={config.tone}
          onChange={(e) => setConfig({ ...config, tone: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </Field>
      <Field label="Knowledge base (external data source · one fact per line)">
        <textarea
          rows={5}
          value={config.knowledge ?? ""}
          onChange={(e) => setConfig({ ...config, knowledge: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
        />
      </Field>
      <button
        onClick={handleSaveVersion}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Save as new prompt version
      </button>
      {versions.length > 0 && (
        <Field label="Prompt versions">
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {versions.map((v) => (
              <button
                key={v.id}
                onClick={() => loadVersion(v.id)}
                className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                  activeVersionId === v.id
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-secondary text-secondary-foreground hover:border-primary"
                }`}
              >
                <span className="font-medium">{v.name}</span>
                <span className="block text-muted-foreground">
                  {new Date(v.created_at).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </Field>
      )}
    </section>
  );

  const metricsPanel = (
    <section className="grid grid-cols-2 gap-3">
      <Metric label="Avg quality" value={scored.length ? `${avg("score")}` : "—"} suffix="/100" />
      <Metric label="Turns" value={`${messages.filter((m) => m.role === "user").length}`} />
      <Metric label="Relevance" value={scored.length ? `${avg("relevance")}` : "—"} suffix="/10" />
      <Metric label="Clarity" value={scored.length ? `${avg("clarity")}` : "—"} suffix="/10" />
      <Metric label="Tone match" value={scored.length ? `${avg("toneMatch")}` : "—"} suffix="/10" />
      <Metric label="Fallbacks" value={`${fallbacks}`} />
      <p className="col-span-2 text-xs leading-relaxed text-muted-foreground">
        Every answer is scored by a second AI evaluator against your system prompt and tone. Every
        conversation is logged with its prompt version.
      </p>
    </section>
  );

  return (
    <div className="min-h-screen panel-grid">
      <Toaster theme="dark" position="top-center" />
      <header className="border-b border-border bg-background/80 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Prompt<span className="text-primary text-glow">Forge</span>
            </h1>
            <p className="font-mono text-[11px] text-muted-foreground">
              end-to-end generative AI · advanced prompt engineering
            </p>
          </div>
          <div className="flex gap-2">
          <Link to="/docs" className="rounded-md border border-border px-3 py-1.5 text-xs transition hover:border-primary hover:text-primary">
            Docs
          </Link>
          <button
            onClick={resetChat}
            className="rounded-md border border-border px-3 py-1.5 text-xs transition hover:border-primary hover:text-primary"
          >
            New chat
          </button>
          </div>
        </div>
      </header>

      <nav className="flex border-b border-border bg-background lg:hidden">
        {(["prompt", "chat", "metrics"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm capitalize transition ${
              tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[340px_1fr_260px] lg:p-6">
        <aside
          className={`rounded-xl border border-border bg-card p-5 ${tab === "prompt" ? "" : "hidden"} lg:block`}
        >
          <PanelTitle>Prompt architecture</PanelTitle>
          {promptPanel}
        </aside>

        <section
          className={`flex h-[calc(100vh-170px)] flex-col rounded-xl border border-border bg-card lg:h-[calc(100vh-120px)] ${tab === "chat" ? "flex" : "hidden"} lg:flex`}
        >
          <div className="border-b border-border px-5 py-3">
            <PanelTitle>Live conversation</PanelTitle>
            <p className="-mt-2 truncate text-xs text-muted-foreground">{config.useCase}</p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-lg font-semibold">Test your prompt</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Ask an in-scope question, a follow-up that needs memory, then an off-topic one to
                  see the fallback trigger.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-secondary text-secondary-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.role === "assistant" && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px]">
                      {m.usedFallback && (
                        <span className="rounded bg-warning/20 px-1.5 py-0.5 text-warning">
                          FALLBACK
                        </span>
                      )}
                      {m.evaluation && (
                        <span
                          className={`rounded px-1.5 py-0.5 ${
                            m.evaluation.score >= 75
                              ? "bg-success/20 text-success"
                              : "bg-warning/20 text-warning"
                          }`}
                          title={m.evaluation.feedback}
                        >
                          QUALITY {m.evaluation.score}/100
                        </span>
                      )}
                      {m.sources && m.sources.length > 0 && (
                        <span className="rounded bg-accent px-1.5 py-0.5 text-accent-foreground" title={m.sources.join("\n")}>
                          {m.sources.length} SOURCE{m.sources.length > 1 ? "S" : ""}
                        </span>
                      )}
                      {m.evaluation?.feedback && (
                        <span className="text-muted-foreground">{m.evaluation.feedback}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="font-mono text-xs text-muted-foreground animate-pulse">
                generating + evaluating…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2 border-t border-border p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a user message…"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              disabled={loading || !input.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </section>

        <aside
          className={`rounded-xl border border-border bg-card p-5 ${tab === "metrics" ? "" : "hidden"} lg:block`}
        >
          <PanelTitle>Quality metrics</PanelTitle>
          {metricsPanel}
        </aside>
      </main>
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
      {children}
    </h2>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">
        {value}
        {suffix && value !== "—" && (
          <span className="text-xs font-normal text-muted-foreground">{suffix}</span>
        )}
      </p>
    </div>
  );
}
