import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "PromptForge Docs — Capstone Project Documentation" },
      {
        name: "description",
        content:
          "Complete documentation for PromptForge: architecture, prompt design, memory, versioning, evaluation, fallbacks, RAG and deployment.",
      },
      { property: "og:title", content: "PromptForge Docs — Capstone Project Documentation" },
      {
        property: "og:description",
        content: "How PromptForge meets every requirement of the end-to-end generative AI capstone.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Docs,
});

const REQUIREMENTS: [string, string][] = [
  ["Business use case definition", "Three ready presets (NovaBank support, HR policy assistant, course advisor) plus a free-text use-case field. The use case is injected as the first line of every system instruction."],
  ["System and user prompt architecture", "Layered prompt: use case → authoritative system prompt → tone → retrieved knowledge → memory rules → fallback rule. User messages stay separate from instructions, preventing prompt injection from overriding policy."],
  ["Context management and memory", "The full conversation history is sent each turn, so follow-ups like \"how long until it arrives?\" resolve correctly. Each conversation and message is stored in the database."],
  ["Prompt versioning and experimentation", "\"Save as new prompt version\" stores the configuration; any version can be reloaded to A/B test behaviour. Every conversation records the version it used."],
  ["Response evaluation and quality metrics", "A second AI evaluator scores each answer (quality /100, relevance, clarity, tone match /10) with one-line feedback. The metrics panel shows running averages and fallback counts."],
  ["Error handling and fallback prompts", "Off-topic or unanswerable requests trigger the configured fallback with a fixed marker, flagged as FALLBACK and logged. Network/AI errors show a toast and restore the user's message; evaluator failures degrade gracefully."],
  ["Integration with external data sources", "A knowledge base (one fact per line) acts as an external data source. Relevant facts are retrieved per question (keyword RAG), injected into the prompt, and shown as SOURCES badges on answers."],
  ["Deployment-ready workflow", "Full-stack app: React UI, server functions holding the AI key, hosted database with row-level security, one-click publish to a live URL."],
  ["Complete project documentation", "This page: requirements mapping, architecture, workflow, test plan and outcomes."],
];

const OUTCOMES = [
  "End-to-end experience: UI, prompt layer, AI gateway, evaluation loop, storage and deployment in one system.",
  "Industry-grade capstone: versioning, logging, automated QA scoring and grounded answers mirror real production assistants.",
  "Prompt engineering best practices: role + scope definition, layered instructions, tone control, grounding, explicit fallback markers, LLM-as-judge evaluation.",
  "Job relevance: covers the daily work of Prompt Engineers (prompt design & testing), Generative AI Engineers (RAG, pipelines, evaluation) and AI Product Developers (use-case framing, metrics, shipping).",
];

function Docs() {
  return (
    <div className="min-h-screen panel-grid">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/" className="font-mono text-xs text-primary">← back to studio</Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Prompt<span className="text-primary">Forge</span> documentation
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Project 8 · End-to-End Generative AI Application with Advanced Prompt Engineering
        </p>

        <Section title="1. Requirements checklist">
          <ol className="space-y-3">
            {REQUIREMENTS.map(([t, d], i) => (
              <li key={t} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-semibold">
                  <span className="text-success">✓</span> {i + 1}. {t}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="2. Architecture">
          <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-xs leading-relaxed">{`User ─▶ Studio UI (prompt editor · chat · metrics)
          │
          ▼
   Server function: sendMessage
     1. log user message  ─────────▶ Database (conversations, messages)
     2. retrieve knowledge (RAG)
     3. build layered prompt + history
     4. AI model  ─▶ answer
     5. detect fallback marker
     6. AI evaluator ─▶ scores + feedback
     7. log answer + scores ───────▶ Database
          │
          ▼
   UI shows answer, FALLBACK / QUALITY / SOURCES badges`}</pre>
        </Section>

        <Section title="3. Workflow & test plan">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Pick a preset or write your own use case, system prompt, tone and knowledge base.</li>
            <li>Ask an in-scope question → expect a grounded answer with SOURCES and a quality score.</li>
            <li>Ask a follow-up using "it"/"that" → verifies memory.</li>
            <li>Ask something off-topic → expect the FALLBACK badge.</li>
            <li>Edit the prompt, save a new version, rerun the same questions and compare metrics.</li>
            <li>Publish to get a live, shareable URL.</li>
          </ol>
        </Section>

        <Section title="4. Expected outcomes">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {OUTCOMES.map((o) => (
              <li key={o}><span className="text-success">✓</span> {o}</li>
            ))}
          </ul>
        </Section>

        <Section title="5. Tech stack">
          <p className="text-sm text-muted-foreground">
            React + TanStack Start, Tailwind CSS, server functions, Lovable Cloud database, Lovable AI
            (GPT model via Responses API, streamed server-side).
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-primary">{title}</h2>
      {children}
    </section>
  );
}
