-- Add credits_used to lessons for accurate ledger
-- Add amount/direction to notifications for redemption tracking

-- Track credits consumed per lesson
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS credits_used INT NOT NULL DEFAULT 1;

-- Track credit movement in notifications for ledger reconstruction
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS credits_delta INT;
