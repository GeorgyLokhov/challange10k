/**
 * API маршруты приложения
 * Объединяет все API эндпоинты в один роутер
 */

const express = require('express');
const router = express.Router();
const webhookRouter = require('./webhook');
const healthRouter = require('./health');
const logger = require('../utils/logger');

// Middleware для логирования запросов
router.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Регистрация маршрутов
router.use('/webhook', webhookRouter);
router.use('/health', healthRouter);

// Корневой маршрут API
router.get('/', (req, res) => {
  res.json({
    message: 'Weekly Reports Bot API',
    endpoints: [
      '/api/webhook/telegram - Telegram webhook endpoint',
      '/api/webhook/setup - Настройка webhook (требуется токен)',
      '/api/health - Проверка работоспособности системы'
    ]
  });
});

// Обработка ошибок API
router.use((err, req, res, next) => {
  logger.error(`API ошибка: ${err.message}`, err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Внутренняя ошибка сервера'
  });
});

module.exports = router; 