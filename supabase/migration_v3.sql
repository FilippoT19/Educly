-- Educly Migration v3
-- Run in Supabase → SQL Editor

-- Add engineering + section to source_documents
ALTER TABLE public.source_documents
  ADD COLUMN IF NOT EXISTS engineering text NOT NULL DEFAULT 'tutti',
  ADD COLUMN IF NOT EXISTS section     text NOT NULL DEFAULT 'tutti';

-- Add engineering + section + source_document_id to exercises
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS engineering        text NOT NULL DEFAULT 'tutti',
  ADD COLUMN IF NOT EXISTS section            text NOT NULL DEFAULT 'tutti',
  ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES public.source_documents(id);

-- Add engineering + section + source_document_id to theory_lessons
ALTER TABLE public.theory_lessons
  ADD COLUMN IF NOT EXISTS engineering        text NOT NULL DEFAULT 'tutti',
  ADD COLUMN IF NOT EXISTS section            text NOT NULL DEFAULT 'tutti',
  ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES public.source_documents(id);

-- Create tmp-pdfs storage bucket (for admin PDF uploads)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tmp-pdfs', 'tmp-pdfs', false)
ON CONFLICT (id) DO NOTHING;
