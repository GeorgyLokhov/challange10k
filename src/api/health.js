/**
 * Эндпоинт для проверки работоспособности системы (health check)
 */

const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheets');
const logger = require('../utils/logger');
const pkg = require('../../package.json');

/**
 * GET /api/health
 * Проверяет состояние основных компонентов системы
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Проверка подключения к Google Sheets
    let sheetsStatus = 'OK';
    let sheetsError = null;
    
    try {
      const isConnected = await sheetsService.testConnection();
      if (!isConnected) {
        sheetsStatus = 'ERROR';
        sheetsError = 'Не удалось подключиться к Google Sheets';
      }
    } catch (error) {
      sheetsStatus = 'ERROR';
      sheetsError = error.message;
      logger.error('Ошибка при проверке подключения к Google Sheets:', error);
    }
    
    // Время выполнения проверки
    const responseTime = Date.now() - startTime;
    
    // Формируем ответ
    const healthStatus = {
      status: sheetsStatus === 'OK' ? 'OK' : 'ERROR',
      version: pkg.version,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      components: {
        server: {
          status: 'OK',
          uptime: Math.floor(process.uptime())
        },
        googleSheets: {
          status: sheetsStatus,
          error: sheetsError
        }
      }
    };
    
    // Определяем HTTP-статус ответа на основе общего статуса
    const httpStatus = healthStatus.status === 'OK' ? 200 : 503;
    
    res.status(httpStatus).json(healthStatus);
  } catch (error) {
    logger.error('Ошибка при проверке работоспособности системы:', error);
    res.status(500).json({
      status: 'ERROR',
      error: 'Внутренняя ошибка сервера при проверке работоспособности',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router; 