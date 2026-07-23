-- Admin support: is_admin flag, timing fields, error tracking

-- Add is_admin to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Add timing + error fields to lessons
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS error_type TEXT;

-- Create LLM error log table
CREATE TABLE IF NOT EXISTS llm_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  attempt_number INT NOT NULL DEFAULT 1,
  source_text_hash TEXT,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_errors_user_id ON llm_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_errors_created_at ON llm_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_errors_lesson_id ON llm_errors(lesson_id);

-- RLS: only service role / admin should read llm_errors
ALTER TABLE llm_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert llm_errors"
  ON llm_errors FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can read llm_errors"
  ON llm_errors FOR SELECT USING (true);

-- Auto-promote the first signed-up user to admin
CREATE OR REPLACE FUNCTION public.promote_first_user_to_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- If no admin exists yet, make this user an admin
  IF NOT EXISTS (SELECT 1 FROM public.user_settings WHERE is_admin = true) THEN
    UPDATE public.user_settings SET is_admin = true WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_first_user_admin ON public.user_settings;
CREATE TRIGGER on_first_user_admin
  AFTER INSERT ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.promote_first_user_to_admin();
