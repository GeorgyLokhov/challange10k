/**
 * Состояние создания нового отчета
 * Обрабатывает начальный этап создания еженедельного отчета
 */

const BaseState = require('./baseState');
const config = require('../../../utils/config');
const logger = require('../../../utils/logger');
const sheetsService = require('../../../services/sheets');
const WeeklyReport = require('../../../services/sheets/models/WeeklyReport');

class ReportState extends BaseState {
  /**
   * Создает экземпляр состояния создания отчета
   */
  constructor() {
    super(config.states.ENTERING_STATE);
    
    // Ограничения на оценку состояния
    this.minStateValue = 1;
    this.maxStateValue = 10;
  }

  /**
   * Входит в состояние создания отчета
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   */
  async enter(context) {
    logger.info(`Пользователь ${context.userId} вошел в состояние создания отчета`);
    
    // Проверяем, есть ли уже начатый отчет
    const existingReport = context.weeklyReport;
    
    if (existingReport) {
      // Если есть начатый отчет, спрашиваем, хочет ли пользователь продолжить его или создать новый
      await this._sendInlineKeyboard(
        context,
        'У вас есть начатый отчет. Хотите продолжить его или создать новый?',
        [
          [
            { text: '✏️ Продолжить', callback_data: 'report_continue' },
            { text: '🆕 Создать новый', callback_data: 'report_new' }
          ]
        ]
      );
    } else {
      // Если нет начатого отчета, начинаем создание нового
      await this._startNewReport(context);
    }
  }

  /**
   * Обрабатывает сообщение в состоянии создания отчета
   * @param {Object} context - Контекст пользователя
   * @param {Object} message - Сообщение от пользователя
   * @returns {Promise<string|null>} - Следующее состояние или null
   */
  async handleMessage(context, message) {
    // Проверяем наличие текста в сообщении
    if (!message.text) {
      await this._sendMessage(
        context, 
        'Пожалуйста, отправьте число от 1 до 10, чтобы оценить ваше состояние.'
      );
      return null;
    }

    const text = message.text.trim();

    // Если пользователь отменяет создание отчета
    if (text === '/cancel' || text.toLowerCase() === 'отмена') {
      await this._cancelReport(context);
      return config.states.NONE;
    }

    // Обрабатываем оценку состояния
    const stateValue = parseInt(text, 10);

    // Проверяем, что введено корректное число
    if (isNaN(stateValue) || stateValue < this.minStateValue || stateValue > this.maxStateValue) {
      await this._sendMessage(
        context,
        `Пожалуйста, введите число от ${this.minStateValue} до ${this.maxStateValue}.`
      );
      return null;
    }

    // Сохраняем оценку состояния в контексте пользователя
    context.weeklyReport.state = stateValue;
    await context.save();
    
    logger.info(`Пользователь ${context.userId} установил оценку состояния: ${stateValue}`);

    // Переходим к следующему этапу - отметке выполненных задач
    return config.states.MARKING_TASKS;
  }

  /**
   * Обрабатывает коллбэк-запросы (нажатия на инлайн кнопки)
   * @param {Object} context - Контекст пользователя
   * @param {Object} query - Данные коллбэк-запроса
   * @returns {Promise<string|null>} - Следующее состояние или null
   */
  async handleCallbackQuery(context, query) {
    // Отвечаем на коллбэк, чтобы убрать индикатор загрузки
    await this._answerCallbackQuery(context, query.id);
    
    // Обрабатываем различные типы коллбэков
    switch (query.data) {
      case 'report_continue':
        // Продолжаем с существующим отчетом
        await this._sendMessage(
          context,
          'Продолжаем работу с начатым отчетом.\n\n' +
          'Сейчас вы находитесь на этапе оценки своего состояния. ' +
          'Оцените ваше текущее состояние по шкале от 1 до 10, где:\n\n' +
          '1-3 - плохое состояние 😢\n' +
          '4-6 - среднее состояние 😐\n' +
          '7-9 - хорошее состояние 😊\n' +
          '10 - отличное состояние 🤩'
        );
        return null;
        
      case 'report_new':
        // Создаем новый отчет
        await this._startNewReport(context);
        return null;
        
      default:
        logger.warn(`Неизвестный коллбэк: ${query.data}`);
        return null;
    }
  }

  /**
   * Начинает создание нового отчета
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   * @private
   */
  async _startNewReport(context) {
    try {
      // Определяем номер текущей недели
      const today = new Date();
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const weekNumber = Math.ceil((((today - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7);
      
      // Создаем новый экземпляр отчета
      context.weeklyReport = new WeeklyReport({
        weekNumber,
        date: today,
        userId: context.userId,
        username: context.username || `user_${context.userId}`
      });
      
      // Сохраняем контекст
      await context.save();
      
      // Отправляем сообщение с инструкцией
      await this._sendMessage(
        context,
        'Начинаем создание нового еженедельного отчета.\n\n' +
        'Сначала оцените ваше текущее состояние по шкале от 1 до 10, где:\n\n' +
        '1-3 - плохое состояние 😢\n' +
        '4-6 - среднее состояние 😐\n' +
        '7-9 - хорошее состояние 😊\n' +
        '10 - отличное состояние 🤩\n\n' +
        'Просто отправьте число от 1 до 10.\n' +
        '\n' +
        'Для отмены создания отчета отправьте /cancel.'
      );
      
      logger.info(`Пользователь ${context.userId} начал создание нового отчета`);
    } catch (error) {
      logger.error(`Ошибка при создании нового отчета: ${error.message}`, error);
      await this._sendMessage(
        context,
        '❌ Произошла ошибка при создании отчета. Пожалуйста, попробуйте позже.'
      );
    }
  }

  /**
   * Отменяет создание отчета
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   * @private
   */
  async _cancelReport(context) {
    // Удаляем отчет из контекста
    delete context.weeklyReport;
    await context.save();
    
    // Отправляем сообщение об отмене
    await this._sendMessage(
      context,
      'Создание отчета отменено.'
    );
    
    logger.info(`Пользователь ${context.userId} отменил создание отчета`);
  }
}

module.exports = new ReportState(); 