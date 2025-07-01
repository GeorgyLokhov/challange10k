/**
 * Основной файл приложения
 * Настройка Express и запуск сервера
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const logger = require('./src/utils/logger');
const config = require('./src/utils/config');
const apiRoutes = require('./src/api');
const sheetsService = require('./src/services/sheets');
const telegramController = require('./src/controllers/telegram');

// Создание Express приложения
const app = express();

// Middleware для парсинга JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Middleware для логирования запросов
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.url}`);
  next();
});

// Основные маршруты
app.use('/api', apiRoutes);

// Корневой маршрут
app.get('/', (req, res) => {
  res.send('Weekly Reports Bot Server');
});

// Обработка 404 ошибок
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Запрашиваемый ресурс не найден' 
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  logger.error('Ошибка сервера:', err);
  res.status(err.statusCode || 500).json({ 
    success: false, 
    message: err.message || 'Внутренняя ошибка сервера' 
  });
});

// Асинхронная функция инициализации сервисов
async function initializeServices() {
  try {
    // Инициализация сервиса Google Sheets
    logger.info('Инициализация Google Sheets API...');
    const sheetsInitialized = await sheetsService.initialize();
    
    if (!sheetsInitialized) {
      logger.error('Не удалось инициализировать Google Sheets API');
    }
    
    // Инициализация Telegram контроллера
    logger.info('Инициализация Telegram контроллера...');
    const telegramInitialized = await telegramController.initialize();
    
    if (!telegramInitialized) {
      logger.error('Не удалось инициализировать Telegram контроллер');
    }
    
    return sheetsInitialized && telegramInitialized;
  } catch (error) {
    logger.error('Ошибка при инициализации сервисов:', error);
    return false;
  }
}

// Запуск сервера
const PORT = config.port;
const HOST = config.server.host;

app.listen(PORT, HOST, async () => {
  logger.info(`Сервер запущен на http://${HOST}:${PORT}`);
  
  // Инициализируем сервисы после запуска сервера
  const initialized = await initializeServices();
  
  if (initialized) {
    logger.success('Все сервисы успешно инициализированы');
  } else {
    logger.warn('Некоторые сервисы не были инициализированы. Проверьте логи для деталей.');
  }
});

// Обработка необработанных исключений
process.on('uncaughtException', (err) => {
  logger.error('Необработанное исключение:', err);
  // Не завершаем процесс, чтобы сервер продолжал работать
});

// Обработка необработанных промисов
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Необработанный промис:', reason);
  // Не завершаем процесс, чтобы сервер продолжал работать
});

module.exports = app;
