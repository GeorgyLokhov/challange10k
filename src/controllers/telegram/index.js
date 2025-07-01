/**
 * Контроллер телеграм-бота
 * Обрабатывает входящие обновления от Telegram API
 */

const TelegramBot = require('node-telegram-bot-api');
const logger = require('../../utils/logger');
const config = require('../../utils/config');
const StateMachine = require('./stateMachine');
const SessionManager = require('./sessionManager');
const noneState = require('./states/noneState');
const reportState = require('./states/reportState');
const markingTasksState = require('./states/markingTasksState');
const addingTasksState = require('./states/addingTasksState');
const commentState = require('./states/commentState');

class TelegramController {
  /**
   * Создает новый экземпляр контроллера телеграм-бота
   */
  constructor() {
    this.initialized = false;
    
    // Инициализация клиента Telegram Bot API
    this.bot = new TelegramBot(config.telegram.token, {
      polling: false // Используем webhook вместо polling
    });
    
    // Инициализация машины состояний
    this.stateMachine = new StateMachine();
    
    // Инициализация менеджера сессий
    this.sessionManager = new SessionManager({
      telegram: this.bot
    });
    
    // Регистрация состояний
    this._registerStates();
  }

  /**
   * Инициализирует контроллер
   * @returns {Promise<boolean>} - Результат инициализации
   */
  async initialize() {
    try {
      // Проверяем доступность бота
      const botInfo = await this.bot.getMe();
      logger.info(`Бот ${botInfo.username} (${botInfo.id}) успешно инициализирован`);
      
      this.initialized = true;
      return true;
    } catch (error) {
      logger.error(`Ошибка инициализации бота: ${error.message}`, error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Настраивает webhook для получения обновлений
   * @param {string} url - URL для webhook
   * @returns {Promise<Object>} - Результат настройки webhook
   */
  async setupWebhook(url) {
    try {
      // Удаляем текущий webhook
      await this.bot.deleteWebHook();
      
      // Устанавливаем новый webhook
      const result = await this.bot.setWebHook(url);
      
      if (result) {
        logger.info(`Webhook успешно установлен на ${url}`);
        return { success: true, url };
      } else {
        logger.error('Не удалось установить webhook');
        return { success: false, error: 'Не удалось установить webhook' };
      }
    } catch (error) {
      logger.error(`Ошибка при настройке webhook: ${error.message}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Обрабатывает входящее обновление от Telegram
   * @param {Object} update - Объект обновления от Telegram
   * @returns {Promise<boolean>} - Результат обработки
   */
  async handleUpdate(update) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Получаем контекст пользователя
      const context = await this.sessionManager.getContextFromUpdate(update);
      
      if (!context) {
        logger.warn('Не удалось получить контекст пользователя из обновления');
        return false;
      }
      
      // Инициализируем состояние пользователя, если оно не установлено
      await this.stateMachine.initializeState(context);
      
      // Обновляем время последней активности
      context.lastActivity = new Date().toISOString();
      
      // Обрабатываем разные типы обновлений
      if (update.message) {
        await this._handleMessage(context, update.message);
      } else if (update.callback_query) {
        await this._handleCallbackQuery(context, update.callback_query);
      }
      
      // Сохраняем обновленный контекст
      await this.sessionManager.saveContext(context.userId, context);
      
      return true;
    } catch (error) {
      logger.error(`Ошибка при обработке обновления: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Обрабатывает текстовое сообщение
   * @param {Object} context - Контекст пользователя
   * @param {Object} message - Сообщение от Telegram
   * @returns {Promise<void>}
   * @private
   */
  async _handleMessage(context, message) {
    // Передаем сообщение напрямую в машину состояний, которая сама решит,
    // как обрабатывать команды в текущем состоянии
    await this.stateMachine.handleMessage(context, message);
  }

  /**
   * Обрабатывает коллбэк-запрос (нажатие на инлайн кнопку)
   * @param {Object} context - Контекст пользователя
   * @param {Object} query - Коллбэк-запрос от Telegram
   * @returns {Promise<void>}
   * @private
   */
  async _handleCallbackQuery(context, query) {
    await this.stateMachine.handleCallbackQuery(context, query);
  }

  /**
   * Регистрирует состояния в машине состояний
   * @private
   */
  _registerStates() {
    // Регистрируем базовое состояние
    this.stateMachine.registerState(noneState);
    
    // Регистрация состояний процесса создания отчета
    this.stateMachine.registerState(reportState);
    this.stateMachine.registerState(markingTasksState);
    this.stateMachine.registerState(addingTasksState);
    this.stateMachine.registerState(commentState);
  }
}

// Экспортируем singleton
module.exports = new TelegramController(); 