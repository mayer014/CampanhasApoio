-- Add system_instruction column to ai_settings
ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS system_instruction TEXT;

-- Update the get_active_ai_setting function if it exists or ensure it returns the new column
-- (The server function in TypeScript will fetch it manually, but we should check if there are database functions)
