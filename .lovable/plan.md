

# Интеграция RadialOrbitalTimeline на Landing Page

## Что делаем

Добавляем орбитальный таймлайн как секцию "Roadmap проекта" на главную страницу (Index), между FeatureCards и HowItWorks. Показывается только для неавторизованных пользователей — как презентация этапов развития APLink.

## Данные таймлайна

Вместо демо-данных — реальные этапы проекта APLink:

| ID | Название | Статус | Описание |
|----|----------|--------|----------|
| 1 | Запуск платформы | completed | Видеозвонки, комнаты, базовый UI |
| 2 | AI интеграция | completed | HuggingFace, перевод, субтитры |
| 3 | Google Meet фичи | in-progress | Реакции, PiP, демонстрация экрана |
| 4 | Автоматизация | in-progress | Telegram бот, уведомления, аналитика |
| 5 | Монетизация | pending | Маркетплейс, партнёрская программа |
| 6 | Масштабирование | pending | Глобальное расширение, enterprise |

## Файлы

| Файл | Действие |
|------|----------|
| `src/components/ui/radial-orbital-timeline.tsx` | Создать — компонент (адаптированный под цвета проекта: cyan primary вместо indigo) |
| `src/index.css` | Добавить `.bg-gradient-orbital` и `.shadow-orbital` (остальные утилиты уже есть через Tailwind) |
| `src/pages/Index.tsx` | Добавить секцию между FeatureCards и HowItWorks |

## Адаптация под дизайн-систему

- Заменить фиксированные цвета (indigo/blue/teal) на `hsl(var(--primary))` (cyan)
- Статусы: completed = primary, in-progress = white, pending = muted
- Использовать существующие `glass` / `glass-dark` классы для карточек
- Не трогать Badge/Button/Card — уже есть в проекте

## Не нужно

- NPM зависимости уже установлены (lucide-react, class-variance-authority, @radix-ui/react-slot)
- Badge, Button, Card уже есть — не перезаписывать
- Большинство CSS утилитов из предложенного globals.css уже покрыты Tailwind — добавляем только 2 кастомных класса

