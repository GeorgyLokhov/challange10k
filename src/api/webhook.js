/**
 * Обработчик webhook от Telegram API
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const config = require('../utils/config');
const telegramController = require('../controllers/telegram');

/**
 * POST /api/webhook/telegram
 * Обрабатывает входящие обновления от Telegram Bot API
 */
router.post('/telegram', async (req, res) => {
  try {
    logger.info('Получен webhook от Telegram');
    logger.debug('Webhook данные:', { update: req.body });
    
    // Проверка, что это действительно обновление от Telegram
    if (!req.body || !req.body.update_id) {
      logger.warn('Получены некорректные данные webhook');
      return res.status(400).send('Bad Request: Invalid webhook data');
    }
    
    // Передаем обновление контроллеру Telegram бота для обработки
    await telegramController.handleUpdate(req.body);
    
    // Отправляем быстрый ответ Telegram серверу
    res.status(200).send('OK');
  } catch (error) {
    logger.error(`Ошибка при обработке webhook: ${error.message}`, error);
    // Даже при ошибке отправляем OK, чтобы Telegram не повторял запрос
    res.status(200).send('OK');
  }
});

/**
 * GET /api/webhook/setup
 * Настраивает webhook для Telegram бота (используется при инициализации)
 */
router.get('/setup', async (req, res) => {
  try {
    const token = req.query.token;
    
    // Проверка безопасного токена для настройки webhook
    if (!token || token !== config.telegram.setupToken) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    // Настраиваем webhook
    const webhookUrl = `${config.server.baseUrl}${config.telegram.webhookPath}`;
    const result = await telegramController.setupWebhook(webhookUrl);
    
    res.status(200).json({ 
      success: true, 
      message: 'Webhook настроен успешно',
      url: webhookUrl,
      result
    });
  } catch (error) {
    logger.error(`Ошибка при настройке webhook: ${error.message}`, error);
    res.status(500).json({ 
      success: false, 
      message: `Ошибка при настройке webhook: ${error.message}` 
    });
  }
});

module.exports = router; 