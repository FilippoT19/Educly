-- migration_v9: allow difficulty 0 for "esempio" exercises

-- Remove the existing check constraint if any, allow 0
ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_difficulty_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_difficulty_check CHECK (difficulty >= 0 AND difficulty <= 3);
