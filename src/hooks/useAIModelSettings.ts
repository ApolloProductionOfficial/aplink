import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AIModelConfig {
  provider: 'lovable' | 'openrouter';
  model: string;
}

// OpenRouter models optimized for different tasks
export const OPENROUTER_MODELS = [
  // Fast & cheap - translations, captions
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', speed: 'fast', category: 'balanced' },
  { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', speed: 'fastest', category: 'fast' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', speed: 'fast', category: 'fast' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', speed: 'fast', category: 'fast' },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', speed: 'fast', category: 'balanced' },
  // Medium - chat, summarization
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', speed: 'medium', category: 'quality' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', speed: 'medium', category: 'quality' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', speed: 'medium', category: 'quality' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', speed: 'fast', category: 'balanced' },
  // Top tier - complex analysis
  { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4', speed: 'slow', category: 'premium' },
  { id: 'openai/o1', name: 'OpenAI o1', speed: 'slow', category: 'premium' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', speed: 'medium', category: 'quality' },
] as const;

export const LOVABLE_MODELS = [
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', speed: 'fast', category: 'balanced' },
  { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', speed: 'fastest', category: 'fast' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', speed: 'medium', category: 'quality' },
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', speed: 'fast', category: 'balanced' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', speed: 'fast', category: 'balanced' },
  { id: 'openai/gpt-5', name: 'GPT-5', speed: 'medium', category: 'quality' },
] as const;

// Recommended models per use case — fast models for real-time tasks, smart models for analysis
export const RECOMMENDED_MODELS: Record<string, { openrouter: string; lovable: string; label: string; icon: string }> = {
  chat:        { openrouter: 'openai/gpt-4o-mini',          lovable: 'google/gemini-2.5-flash',      label: 'Чат',           icon: '💬' },
  translation: { openrouter: 'google/gemini-2.5-flash-lite', lovable: 'google/gemini-2.5-flash-lite', label: 'Перевод',       icon: '🌍' },
  captions:    { openrouter: 'google/gemini-2.5-flash-lite', lovable: 'google/gemini-2.5-flash-lite', label: 'Субтитры',      icon: '📝' },
  summarize:   { openrouter: 'anthropic/claude-sonnet-4',    lovable: 'google/gemini-2.5-pro',        label: 'Саммари',       icon: '📊' },
  transcribe:  { openrouter: 'google/gemini-2.5-flash',     lovable: 'google/gemini-2.5-flash',      label: 'Транскрипция',  icon: '🎙️' },
  analysis:    { openrouter: 'openai/gpt-4o',               lovable: 'google/gemini-2.5-pro',        label: 'Анализ',        icon: '🧠' },
};

export type AITask = keyof typeof RECOMMENDED_MODELS;

const DEFAULT_CONFIG: AIModelConfig = { provider: 'lovable', model: 'google/gemini-2.5-flash' };

export function useAIModelSettings() {
  const { user } = useAuth();
  const [config, setConfig] = useState<AIModelConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const load = async () => {
      const { data } = await supabase
        .from('ai_model_settings' as any)
        .select('provider, model')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setConfig({ provider: (data as any).provider, model: (data as any).model });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const save = useCallback(async (newConfig: AIModelConfig) => {
    setConfig(newConfig);
    if (!user) return;

    const { error } = await supabase
      .from('ai_model_settings' as any)
      .upsert({
        user_id: user.id,
        provider: newConfig.provider,
        model: newConfig.model,
      } as any, { onConflict: 'user_id' });

    if (error) console.error('Failed to save AI settings:', error);
  }, [user]);

  /** Returns the optimal {provider, model} for a specific task.
   *  If user selected a manual model, it uses that for ALL tasks.
   *  If user is on default model, it auto-picks the best model per task. */
  const getModelForTask = useCallback((task: AITask): AIModelConfig => {
    const rec = RECOMMENDED_MODELS[task];
    if (!rec) return config;

    // Check if user manually chose a non-default model
    const defaultModel = config.provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'google/gemini-2.5-flash';
    const isDefaultModel = config.model === defaultModel;

    if (!isDefaultModel) {
      // User explicitly chose a model — respect their choice for all tasks
      return config;
    }

    // Auto-pick optimal model for this task
    const optimalModel = config.provider === 'openrouter' ? rec.openrouter : rec.lovable;
    return { provider: config.provider, model: optimalModel };
  }, [config]);

  return { config, save, loading, getModelForTask };
}
