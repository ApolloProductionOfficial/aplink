-- Add language column to news table
ALTER TABLE public.news 
ADD COLUMN language text NOT NULL DEFAULT 'en';

-- Create index for faster filtering by language
CREATE INDEX idx_news_language ON public.news(language);

-- Create index for filtering by language and published_at
CREATE INDEX idx_news_language_published ON public.news(language, published_at DESC);