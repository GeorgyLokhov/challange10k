/**
 * Начальное состояние бота (отсутствие активного состояния)
 * Обрабатывает команды и инициирует новые сценарии
 */

const BaseState = require('./baseState');
const config = require('../../../utils/config');
const logger = require('../../../utils/logger');
const sheetsService = require('../../../services/sheets');

class NoneState extends BaseState {
  /**
   * Создает экземпляр начального состояния
   */
  constructor() {
    super(config.states.NONE);
    
    // Команды, доступные в этом состоянии
    this.commands = {
      START: '/start',
      HELP: '/help',
      REPORT: '/report',
      STATS: '/stats'
    };
  }

  /**
   * Входит в начальное состояние
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   */
  async enter(context) {
    logger.info(`Пользователь ${context.userId} вошел в начальное состояние`);
    
    // Отправляем приветствие при входе в состояние
    await this._sendMessageWithKeyboard(
      context,
      'Добро пожаловать в бота еженедельных отчетов! Что вы хотите сделать?',
      [
        [{ text: '📝 Создать отчет' }, { text: '📊 Моя статистика' }],
        [{ text: '❓ Помощь' }]
      ]
    );
  }

  /**
   * Обрабатывает сообщение в начальном состоянии
   * @param {Object} context - Контекст пользователя
   * @param {Object} message - Сообщение от пользователя
   * @returns {Promise<string|null>} - Следующее состояние или null
   */
  async handleMessage(context, message) {
    // Проверяем наличие текста в сообщении
    if (!message.text) {
      await this._sendMessage(
        context, 
        'Пожалуйста, отправьте текстовое сообщение или используйте команды и кнопки.'
      );
      return null;
    }

    const text = message.text.trim();

    // Обрабатываем команды
    if (text.startsWith('/')) {
      return await this._handleCommand(context, text);
    }

    // Обрабатываем кнопки
    if (text === '📝 Создать отчет') {
      return config.states.ENTERING_STATE;
    } else if (text === '📊 Моя статистика') {
      return await this._showStats(context);
    } else if (text === '❓ Помощь') {
      await this._showHelp(context);
      return null;
    }

    // Если текст не распознан, отправляем справку
    await this._sendMessage(
      context,
      'Не понимаю ваш запрос. Пожалуйста, воспользуйтесь кнопками или командами.'
    );
    await this._showHelp(context);
    
    return null;
  }

  /**
   * Проверяет, может ли состояние обработать команду
   * @param {string} command - Команда
   * @returns {boolean} - true, если команда может быть обработана
   */
  canHandleCommand(command) {
    return Object.values(this.commands).includes(command);
  }

  /**
   * Обрабатывает команды
   * @param {Object} context - Контекст пользователя
   * @param {string} command - Текст команды
   * @returns {Promise<string|null>} - Следующее состояние или null
   * @private
   */
  async _handleCommand(context, command) {
    switch (command) {
      case this.commands.START:
        await this._sendMessage(
          context,
          'Добро пожаловать в бота еженедельных отчетов!\n\n' +
          'Здесь вы можете создавать еженедельные отчеты о своей работе ' +
          'и отслеживать свою продуктивность.'
        );
        await this._showHelp(context);
        return null;
        
      case this.commands.HELP:
        await this._showHelp(context);
        return null;
        
      case this.commands.REPORT:
        return config.states.ENTERING_STATE;
        
      case this.commands.STATS:
        return await this._showStats(context);
        
      default:
        await this._sendMessage(
          context,
          'Неизвестная команда. Пожалуйста, воспользуйтесь доступными командами.'
        );
        await this._showHelp(context);
        return null;
    }
  }

  /**
   * Показывает справку
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   * @private
   */
  async _showHelp(context) {
    await this._sendMessage(
      context,
      '*Доступные команды:*\n\n' +
      '📝 /report - Создать новый еженедельный отчет\n' +
      '📊 /stats - Посмотреть личную статистику\n' +
      '❓ /help - Показать эту справку\n\n' +
      'Вы также можете использовать кнопки внизу экрана.'
    );
  }

  /**
   * Показывает статистику пользователя
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<null>} - Всегда возвращает null (остаемся в том же состоянии)
   * @private
   */
  async _showStats(context) {
    try {
      // Получаем статистику пользователя
      const stats = await sheetsService.getUserStats(context.userId);
      
      // Отправляем форматированную статистику
      await this._sendMessage(context, stats.formatForDisplay());
      
    } catch (error) {
      logger.error(`Ошибка при получении статистики: ${error.message}`, error);
      await this._sendMessage(
        context,
        '❌ Не удалось получить статистику. Пожалуйста, попробуйте позже.'
      );
    }
    
    return null;
  }
}

module.exports = new NoneState(); 