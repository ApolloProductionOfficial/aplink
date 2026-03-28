import { motion } from 'framer-motion';
import { Rocket, Brain, Monitor, Bot, DollarSign, Globe } from 'lucide-react';
import RadialOrbitalTimeline from '@/components/ui/radial-orbital-timeline';
import { useTranslation } from '@/hooks/useTranslation';

const RoadmapTimeline = () => {
  const { t } = useTranslation();
  const r = (t.aplink as any)?.roadmap;

  const timelineData = [
    {
      id: 1,
      title: r?.stages?.launch || 'Запуск платформы',
      date: '2024',
      content: r?.stages?.launchDesc || 'Видеозвонки, создание комнат, базовый интерфейс.',
      category: 'Launch',
      icon: Rocket,
      relatedIds: [2],
      status: 'completed' as const,
      energy: 100,
    },
    {
      id: 2,
      title: r?.stages?.ai || 'AI интеграция',
      date: '2024',
      content: r?.stages?.aiDesc || 'Реальный перевод речи, AI-субтитры.',
      category: 'AI',
      icon: Brain,
      relatedIds: [1, 3],
      status: 'completed' as const,
      energy: 95,
    },
    {
      id: 3,
      title: r?.stages?.calls || 'Расширенные звонки',
      date: '2025',
      content: r?.stages?.callsDesc || 'Реакции, PiP-режим, демонстрация экрана.',
      category: 'Features',
      icon: Monitor,
      relatedIds: [2, 4],
      status: 'in-progress' as const,
      energy: 70,
    },
    {
      id: 4,
      title: r?.stages?.automation || 'Автоматизация',
      date: '2025',
      content: r?.stages?.automationDesc || 'Telegram бот, push-уведомления.',
      category: 'Automation',
      icon: Bot,
      relatedIds: [3, 5],
      status: 'in-progress' as const,
      energy: 55,
    },
    {
      id: 5,
      title: r?.stages?.monetization || 'Монетизация',
      date: '2025',
      content: r?.stages?.monetizationDesc || 'Маркетплейс услуг.',
      category: 'Business',
      icon: DollarSign,
      relatedIds: [4, 6],
      status: 'pending' as const,
      energy: 20,
    },
    {
      id: 6,
      title: r?.stages?.scaling || 'Масштабирование',
      date: '2026',
      content: r?.stages?.scalingDesc || 'Глобальное расширение.',
      category: 'Scale',
      icon: Globe,
      relatedIds: [5],
      status: 'pending' as const,
      energy: 10,
    },
  ];

  return (
    <section className="py-16 md:py-24 relative z-10">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
              {r?.title || 'Roadmap проекта'}
            </span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {r?.subtitle || 'Этапы развития APLink — от идеи до глобальной платформы'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <RadialOrbitalTimeline
            timelineData={timelineData}
            labels={{
              statusDone: r?.statusDone || 'ГОТОВО',
              statusInProgress: r?.statusInProgress || 'В РАБОТЕ',
              statusPending: r?.statusPending || 'ПЛАНЫ',
              progress: r?.progress || 'Прогресс',
              relatedStages: r?.relatedStages || 'Связанные этапы',
            }}
          />
        </motion.div>
      </div>
    </section>
  );
};

export default RoadmapTimeline;
