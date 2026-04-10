-- Educly Migration v6
-- Run in Supabase → SQL Editor

-- Add answers JSONB: array of {label, type, value}
-- answers format: [{"label":"Risultato","type":"exact","value":"pi/4"}, ...]
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS answers jsonb DEFAULT '[]';

-- Replace solution_steps text[] with jsonb for structured step objects
-- safe to drop — was added in v5 but never populated in practice
ALTER TABLE public.exercises DROP COLUMN IF EXISTS solution_steps;
ALTER TABLE public.exercises ADD COLUMN solution_steps jsonb DEFAULT '[]';
-- solution_steps format: [{step,title,text,formula,detail,weight}, ...]
