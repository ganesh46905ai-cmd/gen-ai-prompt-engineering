CREATE TABLE public.prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  use_case TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  fallback_prompt TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'professional',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_versions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_versions TO authenticated;
GRANT ALL ON public.prompt_versions TO service_role;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon full access prompt_versions" ON public.prompt_versions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access prompt_versions" ON public.prompt_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_version_id UUID REFERENCES public.prompt_versions(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon full access conversations" ON public.conversations FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access conversations" ON public.conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  used_fallback BOOLEAN NOT NULL DEFAULT false,
  eval_score INTEGER,
  eval_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon full access messages" ON public.messages FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access messages" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);