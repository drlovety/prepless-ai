-- Create access_codes table (master list of valid codes)
CREATE TABLE IF NOT EXISTS access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  total_uses int NOT NULL DEFAULT 1,
  remaining_uses int NOT NULL DEFAULT 1,
  credits_per_use int NOT NULL DEFAULT 1,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

-- Create user_credits table (per-user credit balance)
CREATE TABLE IF NOT EXISTS user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  remaining_credits int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Users can only read their own credits
CREATE POLICY "Users read own credits" ON user_credits
  FOR SELECT USING (auth.uid() = user_id);

-- Function: decrement code uses atomically
CREATE OR REPLACE FUNCTION decrement_code_uses(code_input text)
RETURNS void AS $$
BEGIN
  UPDATE access_codes
  SET remaining_uses = remaining_uses - 1
  WHERE code = code_input AND remaining_uses > 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Code exhausted or not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: add credits to user (upsert)
CREATE OR REPLACE FUNCTION add_user_credits(user_id_input uuid, amount int)
RETURNS void AS $$
BEGIN
  INSERT INTO user_credits (user_id, remaining_credits)
  VALUES (user_id_input, amount)
  ON CONFLICT (user_id)
  DO UPDATE SET remaining_credits = user_credits.remaining_credits + amount,
                updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
