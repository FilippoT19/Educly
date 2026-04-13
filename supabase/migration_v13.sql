-- migration_v13: allow null solution_latex on exercises (multi-part exercises store solutions in parts JSONB)
ALTER TABLE public.exercises ALTER COLUMN solution_latex DROP NOT NULL;
