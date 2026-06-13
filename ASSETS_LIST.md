# CF Project - Список всех ассетов

Полный список файлов для переноса в новый проект.

---

## 📁 Структура папок для копирования

```
public/
├── audio/
│   └── oscar-welcome.mp3          # Приветственное аудио
├── fonts/
│   ├── Roboto-Bold.ttf            # Шрифт Roboto Bold
│   └── Roboto-Regular.ttf         # Шрифт Roboto Regular
├── images/
│   └── apollo-logo.png            # Логотип Apollo
├── favicon.png                     # Иконка сайта
└── robots.txt                      # SEO файл

src/assets/
├── cf-logo-final.png              # Финальный логотип CF
├── cf-logo-new.png                # Новый логотип CF
├── cf-logo-transparent.png        # Прозрачный логотип CF
├── cf-logo.png                    # Основной логотип CF
├── custom-logo.jpg                # Кастомный логотип
├── onlyfans-logo.png              # Логотип OnlyFans
├── apollo-logo.mp4                # Видео логотипа Apollo
├── background-video.mp4           # Фоновое видео
├── background-video-new.mp4       # Новое фоновое видео
├── dubai-residency-video.mp4      # Видео Dubai Residency
├── promo-video.mp4                # Промо видео
├── logo-video.mov                 # Видео логотипа
└── marketplace-intro.mov          # Интро маркетплейса
```

---

## 🎨 Логотипы

| Файл | Путь | Описание |
|------|------|----------|
| cf-logo-final.png | src/assets/ | Финальная версия логотипа |
| cf-logo-new.png | src/assets/ | Обновлённый логотип |
| cf-logo-transparent.png | src/assets/ | С прозрачным фоном |
| cf-logo.png | src/assets/ | Стандартный логотип |
| custom-logo.jpg | src/assets/ | Кастомный вариант |
| apollo-logo.png | public/images/ | Логотип Apollo |
| onlyfans-logo.png | src/assets/ | Логотип OnlyFans |
| favicon.png | public/ | Иконка сайта |

---

## 🎬 Видео

| Файл | Путь | Описание |
|------|------|----------|
| background-video.mp4 | src/assets/ | Основное фоновое видео |
| background-video-new.mp4 | src/assets/ | Альтернативное фоновое видео |
| promo-video.mp4 | src/assets/ | Промо ролик |
| dubai-residency-video.mp4 | src/assets/ | Видео для страницы Dubai |
| apollo-logo.mp4 | src/assets/ | Анимированный логотип Apollo |
| logo-video.mov | src/assets/ | Видео с логотипом |
| marketplace-intro.mov | src/assets/ | Интро для маркетплейса |

---

## 🔤 Шрифты

| Файл | Путь | Использование |
|------|------|---------------|
| Roboto-Regular.ttf | public/fonts/ | Основной текст |
| Roboto-Bold.ttf | public/fonts/ | Заголовки, акценты |

### Подключение шрифтов в CSS:
```css
@font-face {
  font-family: 'Roboto';
  src: url('/fonts/Roboto-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'Roboto';
  src: url('/fonts/Roboto-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
}
```

---

## 🔊 Аудио

| Файл | Путь | Описание |
|------|------|----------|
| oscar-welcome.mp3 | public/audio/ | Приветственное сообщение Oscar |

---

## 📋 Инструкции по переносу

### Способ 1: Через GitHub (рекомендуется)
1. Подключи GitHub к текущему проекту
2. Клонируй репозиторий локально
3. Скопируй папки `src/assets/` и `public/` в новый проект

### Способ 2: Вручную
1. Перейди в **Code View** в редакторе
2. Скачай нужные файлы по одному
3. Загрузи их в новый проект через чат

### Способ 3: Remix
1. Сделай Remix этого проекта (Settings → Remix)
2. Новый проект будет содержать все ассеты

---

## 💡 Важно

- Файлы в `src/assets/` импортируются через ES6 модули:
  ```typescript
  import logo from '@/assets/cf-logo-final.png';
  ```

- Файлы в `public/` доступны по прямому URL:
  ```html
  <img src="/images/apollo-logo.png" />
  <audio src="/audio/oscar-welcome.mp3" />
  ```

- Для видео используй компонент или тег:
  ```typescript
  import bgVideo from '@/assets/background-video.mp4';
  
  <video src={bgVideo} autoPlay muted loop />
  ```

---

## 📦 Общий размер

Примерный объём всех ассетов:
- Изображения: ~2-5 MB
- Видео: ~50-200 MB (в зависимости от качества)
- Шрифты: ~200 KB
- Аудио: ~1-5 MB
