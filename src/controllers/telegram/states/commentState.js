/**
 * Состояние ввода комментария к отчету
 * Позволяет пользователю добавить комментарий и завершить создание отчета
 */

const BaseState = require('./baseState');
const config = require('../../../utils/config');
const logger = require('../../../utils/logger');
const sheetsService = require('../../../services/sheets');

class CommentState extends BaseState {
  /**
   * Создает экземпляр состояния ввода комментария
   */
  constructor() {
    super(config.states.ENTERING_COMMENT);
    
    // Максимальная длина комментария
    this.maxCommentLength = 1000;
    
    // Команды
    this.commands = {
      SKIP: '/skip',
      CANCEL: '/cancel',
      SUBMIT: '/submit'
    };
  }

  /**
   * Входит в состояние ввода комментария
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   */
  async enter(context) {
    logger.info(`Пользователь ${context.userId} вошел в состояние ввода комментария`);
    
    // Проверяем, есть ли активный отчет
    if (!context.weeklyReport) {
      logger.error(`Пользователь ${context.userId} попал в состояние комментария без активного отчета`);
      await this._sendMessage(
        context,
        '❌ Ошибка: отчет не найден. Начните создание отчета заново с помощью команды /report.'
      );
      return;
    }
    
    // Если комментарий уже добавлен, показываем его
    if (context.weeklyReport.comment) {
      await this._showCurrentComment(context);
    } else {
      // Отправляем инструкцию по добавлению комментария
      await this._sendMessage(
        context,
        'Последний шаг - добавление комментария к отчету.\n\n' +
        'Напишите дополнительный комментарий о прошедшей неделе или о планах (до 1000 символов).\n\n' +
        'Если не хотите добавлять комментарий, отправьте /skip.\n\n' +
        'Когда будете готовы отправить отчет, используйте команду /submit.\n\n' +
        'Для отмены создания отчета отправьте /cancel.'
      );
    }
  }

  /**
   * Обрабатывает сообщение в состоянии ввода комментария
   * @param {Object} context - Контекст пользователя
   * @param {Object} message - Сообщение от пользователя
   * @returns {Promise<string|null>} - Следующее состояние или null
   */
  async handleMessage(context, message) {
    // Проверяем наличие текста в сообщении
    if (!message.text) {
      await this._sendMessage(
        context, 
        'Пожалуйста, отправьте текстовый комментарий.'
      );
      return null;
    }

    const text = message.text.trim();

    // Обрабатываем команды
    if (text.startsWith('/')) {
      switch (text.split(' ')[0]) {
        case this.commands.SKIP:
          // Пропускаем добавление комментария
          context.weeklyReport.comment = '';
          await context.save();
          
          return await this._submitReport(context);
          
        case this.commands.SUBMIT:
          // Отправляем отчет с текущим комментарием
          return await this._submitReport(context);
          
        case this.commands.CANCEL:
          // Отменяем создание отчета
          await this._cancelReport(context);
          return config.states.NONE;
          
        default:
          await this._sendMessage(
            context,
            'Неизвестная команда. Доступные команды:\n' +
            '/skip - пропустить добавление комментария\n' +
            '/submit - отправить отчет\n' +
            '/cancel - отменить создание отчета'
          );
          return null;
      }
    }

    // Проверяем, не превышена ли максимальная длина комментария
    if (text.length > this.maxCommentLength) {
      await this._sendMessage(
        context,
        `Комментарий слишком длинный. Максимальная длина: ${this.maxCommentLength} символов. ` +
        `Ваш комментарий содержит ${text.length} символов. Пожалуйста, сократите его.`
      );
      return null;
    }

    // Сохраняем комментарий
    context.weeklyReport.comment = text;
    await context.save();
    
    logger.info(`Пользователь ${context.userId} добавил комментарий к отчету`);

    // Показываем текущий комментарий
    await this._showCurrentComment(context);
    
    return null;
  }

  /**
   * Показывает текущий комментарий
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   * @private
   */
  async _showCurrentComment(context) {
    const comment = context.weeklyReport.comment || '';
    const commentLength = comment.length;
    
    let message = `*Ваш комментарий (${commentLength}/${this.maxCommentLength} символов):*\n\n`;
    
    if (commentLength > 0) {
      message += `${comment}\n\n`;
    } else {
      message += 'Комментарий не добавлен.\n\n';
    }
    
    message += 'Вы можете изменить комментарий, просто отправив новый.\n\n' +
               'Когда будете готовы отправить отчет, используйте команду /submit.\n' +
               'Для отмены создания отчета отправьте /cancel.';
    
    await this._sendMessage(context, message);
  }

  /**
   * Отправляет отчет в Google Sheets
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<string|null>} - Следующее состояние или null
   * @private
   */
  async _submitReport(context) {
    try {
      await this._sendMessage(
        context,
        '⏳ Отправка отчета в Google Sheets...'
      );
      
      // Сохраняем отчет через сервис
      await sheetsService.saveReport(context.weeklyReport);
      
      // Отправляем пользователю уведомление об успешном сохранении
      await this._sendMessage(
        context,
        '✅ Ваш еженедельный отчет успешно сохранен!'
      );
      
      // Отправляем пользователю предварительный просмотр отчета
      await this._sendMessage(
        context,
        context.weeklyReport.formatForDisplay()
      );
      
      // Очищаем отчет из контекста пользователя
      delete context.weeklyReport;
      await context.save();
      
      logger.info(`Пользователь ${context.userId} успешно отправил еженедельный отчет`);
      
      // Возвращаемся в начальное состояние
      return config.states.NONE;
    } catch (error) {
      logger.error(`Ошибка при сохранении отчета: ${error.message}`, error);
      
      // Отправляем сообщение об ошибке
      await this._sendMessage(
        context,
        '❌ Произошла ошибка при сохранении отчета. Пожалуйста, попробуйте снова позже или обратитесь к администратору.\n\n' +
        'Ваш отчет сохранен в вашем профиле. Вы можете попробовать отправить его позже с помощью команды /submit.'
      );
      
      return null;
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

module.exports = new CommentState(); 