# CF Project - Полная документация проекта

## 🎨 Дизайн-философия

### Основной стиль
- **Тёмная космическая тема** с неоновыми акцентами
- **Glassmorphism** эффекты (размытые полупрозрачные панели)
- **Анимации**: плавающие орбы, частицы, градиентные переливы
- **Цветовая палитра**: тёмный фон (#0a0a0a), cyan/primary акценты (hsl 186)
- **Шрифты**: Roboto (Regular, Bold) загружены локально

### Визуальные эффекты
1. **FloatingOrbs** - анимированные градиентные сферы на фоне
2. **NeonGlow** - следящий за курсором эффект свечения
3. **ParticleEffect** - интерактивные частицы на canvas
4. **StarField** - звёздное поле на фоне
5. **CustomCursor** - кастомный курсор со spotlight эффектом
6. **AnimatedBackground** - базовый анимированный фон с grid pattern

### Оптимизация производительности
- `useReducedMotion` hook - отключает анимации на мобильных
- `contain: strict` для изоляции перерисовок
- RAF throttling для mouse tracking
- Lazy loading компонентов

---

## 🎯 Ключевые компоненты

### Навигация
- **Header** - фиксированный с glass эффектом
- **BottomNavigation** - мобильная нижняя навигация
- **Sidebar** - боковая панель для dashboard

### Герой-секция
- Вращающийся 3D логотип
- Орбитальные кольца
- Космические лучи и волны энергии
- CTA кнопки с звуковыми эффектами

### Карточки
- **FeatureCards** - интерактивные карточки с hover эффектами
- **ProfileCard** - карточка профиля пользователя
- Glass эффект на всех карточках

### Мультимедиа
- **VideoBanner** - фоновое видео
- **MusicPlayer** - аудио плеер
- **OscarWelcome** - приветственное аудио

---

## 🔐 Аутентификация

### Реализация
- Email/Password регистрация и вход
- Google OAuth
- Двухфакторная аутентификация (2FA)
- Backup codes для восстановления

### Компоненты
- `useAuth` hook - управление auth состоянием
- `TwoFactorSetup` - настройка 2FA
- `TwoFactorVerify` - верификация кода

### Профили пользователей
- Таблица `profiles` с display_name, username, avatar_url
- Аватары хранятся в Supabase Storage bucket 'avatars'
- RLS политики для защиты данных

---

## 🗄️ База данных (Supabase)

### Таблицы
1. **profiles** - профили пользователей
2. **user_roles** - роли (admin/user)
3. **contacts** - контакты пользователя
4. **user_presence** - онлайн статус
5. **meeting_transcripts** - записи встреч
6. **meeting_participants** - участники встреч
7. **translation_history** - история переводов
8. **news** - новости
9. **backup_codes** - коды восстановления 2FA
10. **error_logs** - логи ошибок
11. **site_analytics** - аналитика сайта
12. **shared_meeting_links** - публичные ссылки на встречи

### Безопасность
- RLS политики на всех таблицах
- `is_admin()` функция для проверки роли
- `validate_backup_code()` - безопасная валидация кодов
- Хэширование через pgcrypto

---

## 🌐 Edge Functions

### Реализованные функции
1. **ai-chat** - AI чатбот
2. **realtime-translate** - перевод в реальном времени
3. **summarize-meeting** - суммаризация встреч
4. **fetch-adult-news** - получение новостей
5. **elevenlabs-transcribe** - транскрипция через ElevenLabs
6. **send-error-notification** - уведомления об ошибках
7. **track-participant** - трекинг участников с геоданными

---

## 🌍 Мультиязычность

### Поддерживаемые языки
- Русский (ru) - основной
- Английский (en)
- Немецкий (de)
- Китайский (zh)
- Арабский (ar)

### Реализация
- `LanguageContext` для глобального состояния
- Автоопределение языка по IP
- `useTranslation` hook для переводов
- Переводы в `src/locales/translations.ts`

---

## 📱 Адаптивность

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Мобильные оптимизации
- Отключение тяжёлых анимаций
- Упрощённые визуальные эффекты
- Touch-friendly элементы
- Bottom navigation вместо sidebar

---

## 🎵 Звуковые эффекты

### Hooks
- `useButtonSound` - звук клика кнопок
- `useConnectionSounds` - звуки подключения/отключения

### Аудио файлы
- `/audio/oscar-welcome.mp3` - приветствие

---

## 📊 Страницы

1. **Index** - главная страница
2. **Auth** - вход/регистрация
3. **Dashboard** - личный кабинет
4. **Profile** - профиль пользователя
5. **AdminPanel** - панель администратора
6. **MeetingRoom** - комната встреч
7. **MeetingHistory** - история встреч
8. **Marketplace** - маркетплейс услуг
9. **Services** - страница услуг
10. **DubaiResidency** - резидентство в Дубае
11. **CryptoUnlock** - крипто услуги
12. **AllNews** - все новости

---

## 🎨 CSS Классы и анимации

### Glassmorphism
```css
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### Ключевые анимации
- `animate-float` - плавающее движение
- `animate-pulse-glow` - пульсирующее свечение
- `animate-gradient` - градиентный переход
- `animate-text-shimmer` - мерцание текста
- `animate-orbit` - орбитальное вращение

---

## 🔧 Технологии

- **React 18** + TypeScript
- **Vite** - сборка
- **Tailwind CSS** - стилизация
- **Framer Motion** - анимации
- **Supabase** - бэкенд (через Apollo Supabase)
- **Shadcn/UI** - UI компоненты
- **React Query** - запросы данных

---

## 💡 Идеи и фичи для развития

1. **Видеоконференции** - WebRTC интеграция
2. **AI-ассистент** - персональный помощник
3. **Realtime перевод** - синхронный перевод речи
4. **Геймификация** - достижения и награды
5. **Marketplace** - платформа услуг
6. **Модели** - рекрутинг и верификация
7. **Крипто** - интеграция платежей

---

## 📁 Структура проекта

```
src/
├── assets/          # Изображения, видео, логотипы
├── components/      # UI компоненты
│   └── ui/          # Shadcn компоненты
├── contexts/        # React контексты
├── hooks/           # Кастомные хуки
├── integrations/    # Supabase клиент
├── lib/             # Утилиты
├── locales/         # Переводы
├── pages/           # Страницы приложения
└── utils/           # Вспомогательные функции

public/
├── audio/           # Аудио файлы
├── fonts/           # Шрифты
└── images/          # Публичные изображения

supabase/
└── functions/       # Edge функции
```

---

## 🚀 Как использовать эту документацию

1. **В новом проекте**: Добавь этот файл в Project Settings → Manage Knowledge
2. **Для стиля**: Скопируй index.css и tailwind.config.ts
3. **Для компонентов**: Перенеси нужные из src/components
4. **Для хуков**: Скопируй из src/hooks
5. **Для переводов**: Используй src/locales/translations.ts

Этот документ содержит всю информацию о стиле, архитектуре и подходах проекта.
