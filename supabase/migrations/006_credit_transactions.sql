-- Create a proper credit transaction ledger
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('debit', 'redemption', 'refund', 'purchase', 'adjustment')),
  amount int NOT NULL,
  balance_after int,
  description text,
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Backfill: create debit transactions for all existing lessons
INSERT INTO credit_transactions (user_id, type, amount, description, lesson_id, created_at)
SELECT 
  l.user_id,
  'debit',
  l.credits_used,
  'Lesson: ' || COALESCE(l.topic, l.class_name, 'Unknown'),
  l.id,
  l.created_at
FROM lessons l
WHERE l.credits_used > 0
  AND NOT EXISTS (
    SELECT 1 FROM credit_transactions ct 
    WHERE ct.lesson_id = l.id AND ct.type = 'debit'
  );
