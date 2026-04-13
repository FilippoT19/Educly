-- migration_v12: add book_title and author to source_documents for grouping

ALTER TABLE public.source_documents ADD COLUMN IF NOT EXISTS book_title text;
ALTER TABLE public.source_documents ADD COLUMN IF NOT EXISTS author text;
