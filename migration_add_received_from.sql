-- ペット受け取り記録カラムを追加
-- Supabase の SQL エディタで実行してください
ALTER TABLE lostpet_register ADD COLUMN IF NOT EXISTS received_from TEXT;
