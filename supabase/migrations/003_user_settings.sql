-- User settings table: school profile + default preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  school_name text NOT NULL DEFAULT 'Cascade High School',
  mascot text NOT NULL DEFAULT 'Bruins',
  city text NOT NULL DEFAULT 'Everett',
  state text NOT NULL DEFAULT 'WA',
  primary_color text NOT NULL DEFAULT '#8B0000',
  secondary_color text NOT NULL DEFAULT '#FFD700',
  default_duration text NOT NULL DEFAULT '50',
  default_rigor text NOT NULL DEFAULT 'standard',
  include_journal boolean NOT NULL DEFAULT true,
  include_exit_ticket boolean NOT NULL DEFAULT true,
  include_essential_questions boolean NOT NULL DEFAULT true,
  include_handouts boolean NOT NULL DEFAULT true,
  include_card_sets boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-create settings row on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: create settings when auth.users row is created
DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_settings();

-- Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);
