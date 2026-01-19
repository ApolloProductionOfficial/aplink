-- Создаём таблицу для группировки повторяющихся ошибок
CREATE TABLE public.error_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_hash TEXT NOT NULL UNIQUE,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  occurrence_count INT DEFAULT 1,
  telegram_message_id BIGINT,
  source TEXT,
  severity TEXT DEFAULT 'error'
);

-- Индексы для быстрого поиска
CREATE INDEX idx_error_groups_hash ON public.error_groups(error_hash);
CREATE INDEX idx_error_groups_last_seen ON public.error_groups(last_seen DESC);

-- RLS: только service_role может работать с этой таблицей
ALTER TABLE public.error_groups ENABLE ROW LEVEL SECURITY;

-- Политика для админов - только чтение
CREATE POLICY "Admins can view error groups"
ON public.error_groups
FOR SELECT
TO authenticated
USING (public.is_admin());