/**
 * Конфигурация приложения
 * Содержит все настройки и переменные окружения
 */

require('dotenv').config();

/**
 * Конфигурация приложения
 */
module.exports = {
  // Основные настройки
  port: process.env.PORT || 3000,
  
  // Telegram Bot API
  telegram: {
    token: process.env.TELEGRAM_TOKEN,
    webhookPath: '/api/webhook/telegram'
  },
  
  // Google Sheets API
  google: {
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    credentials: process.env.GOOGLE_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CREDENTIALS) : null,
    reportsSheet: 'Отчеты',
    usersSheet: 'Пользователи'
  },
  
  // Настройки логирования
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    directory: process.env.LOG_DIRECTORY || 'logs'
  },
  
  // Настройки кэширования
  cache: {
    ttl: 60 * 5, // 5 минут
    checkPeriod: 60 // Проверять устаревшие данные каждую минуту
  },
  
  // Настройки сервера
  server: {
    host: process.env.HOST || '0.0.0.0',
  },
  
  // Константы состояний пользователей
  states: {
    NONE: 'none',
    ENTERING_STATE: 'entering_state',
    MARKING_TASKS: 'marking_tasks',
    ADDING_TASKS: 'adding_tasks',
    SETTING_PRIORITY: 'setting_priority',
    ENTERING_COMMENT: 'entering_comment'
  },
}; 