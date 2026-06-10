-- Lessons table: stores generated lesson plans
CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  class_name text,
  topic text,
  source_text text,
  generated_json jsonb,
  credits_used int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fetching user's lessons
CREATE INDEX IF NOT EXISTS idx_lessons_user_id ON lessons(user_id);

-- Row Level Security
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own lessons" ON lessons
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own lessons" ON lessons
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own lessons" ON lessons
  FOR UPDATE USING (auth.uid() = user_id);

-- Function: burn credits atomically (returns true if successful)
CREATE OR REPLACE FUNCTION burn_credit(user_id_input uuid, amount int)
RETURNS boolean AS $$
BEGIN
  UPDATE user_credits
  SET remaining_credits = remaining_credits - amount,
      updated_at = now()
  WHERE user_id = user_id_input AND remaining_credits >= amount;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
