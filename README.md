# Telegram Бот для Еженедельных Отчетов

Бот для создания и управления еженедельными отчетами с интеграцией Google Sheets в качестве базы данных.

## Новая архитектура

Проект был переработан для перехода от архитектуры на базе Google Apps Script к современной архитектуре на Node.js, размещаемой на Render.com. 

### Ключевые особенности:

- **📱 Тот же пользовательский опыт** - функциональность бота сохранена, но улучшена надежность и скорость
- **📊 Google Sheets в качестве базы данных** - без необходимости обслуживания сервера БД
- **🔄 Кэширование данных** - для снижения количества запросов к Google Sheets API
- **⚠️ Улучшенная обработка ошибок** - с автоматическими повторными попытками
- **🔒 Безопасная аутентификация** - с помощью сервисного аккаунта Google
- **📊 Расширенная аналитика** - статистика пользователей и отчетов

### Структура проекта

```
/src
  /api              # Обработчики API-запросов
  /controllers      # Контроллеры бизнес-логики
    /telegram       # Контроллер Telegram бота
      /states       # Состояния машины состояний
  /services         # Сервисы для работы с API
    /sheets         # Сервис для работы с Google Sheets
      /models       # Модели данных
  /utils            # Утилиты (логирование, конфигурация)
```

## Предварительные требования

- Node.js 18.x или выше
- Аккаунт Telegram и токен бота (через [@BotFather](https://t.me/botfather))
- Проект Google с включенным Google Sheets API и сервисным аккаунтом
- Аккаунт на [Render.com](https://render.com/) для деплоя (опционально)

## Установка и запуск локально

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/yourusername/weekly-reports-bot.git
   cd weekly-reports-bot
   ```

2. Установите зависимости:
   ```bash
   npm install
   ```

3. Создайте файл `.env` на основе `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Настройте переменные окружения в файле `.env`:
   - `TELEGRAM_TOKEN`: Токен вашего Telegram бота
   - `GOOGLE_SHEET_ID`: ID таблицы Google Sheets
   - `GOOGLE_CREDENTIALS`: JSON сервисного аккаунта Google (должен иметь доступ к таблице)
   - Остальные переменные по необходимости

5. Запустите приложение в режиме разработки:
   ```bash
   npm run dev
   ```

6. Или в production-режиме:
   ```bash
   npm start
   ```

## Настройка webhook для Telegram

Для настройки webhook есть два способа:

1. **Через URL-запрос**:
   ```
   https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook?url=<SERVER_URL>/api/webhook/telegram
   ```

2. **Через эндпоинт API** (рекомендуется):
   ```
   GET /api/webhook/setup?token=<TELEGRAM_SETUP_TOKEN>
   ```

## Деплой на Render.com

1. Создайте новый Web Service на Render.com
2. Укажите URL репозитория GitHub
3. Укажите тип сервиса: Node
4. Команда сборки: `npm install`
5. Команда запуска: `npm start`
6. Добавьте переменные окружения из `.env.example`
7. Нажмите "Create Web Service"
8. После деплоя настройте webhook для Telegram, используя URL вашего Render приложения

## Разработка

### Добавление новых состояний бота

1. Создайте новый файл в директории `src/controllers/telegram/states/`
2. Расширьте базовый класс `BaseState`
3. Зарегистрируйте новое состояние в `src/controllers/telegram/index.js`

### Добавление новых API эндпоинтов

1. Создайте новый маршрутизатор в директории `src/api/`
2. Добавьте маршруты в `src/api/index.js`

## Лицензия

MIT