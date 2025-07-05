/**
 * Состояние добавления задач на следующую неделю
 * Позволяет пользователю добавить задачи, которые он планирует выполнить
 */

const BaseState = require('./baseState');
const config = require('../../../utils/config');
const logger = require('../../../utils/logger');
const sheetsService = require('../../../services/sheets');

class AddingTasksState extends BaseState {
  /**
   * Создает экземпляр состояния добавления задач на следующую неделю
   */
  constructor() {
    super(config.states.ADDING_TASKS);
    
    // Максимальное количество невыполненных задач и планов
    this.maxTasks = 15;
    
    // Команды
    this.commands = {
      DONE: '/done',
      CANCEL: '/cancel',
      SKIP: '/skip'
    };
  }

  /**
   * Входит в состояние добавления задач
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   */
  async enter(context) {
    logger.info(`Пользователь ${context.userId} вошел в состояние добавления невыполненных задач`);
    
    // Проверяем, есть ли активный отчет
    if (!context.weeklyReport) {
      logger.error(`Пользователь ${context.userId} попал в состояние добавления задач без активного отчета`);
      await this._sendMessage(
        context,
        '❌ Ошибка: отчет не найден. Начните создание отчета заново с помощью команды /report.'
      );
      return;
    }
    
    // Инициализируем массив планов, если его нет
    if (!context.weeklyReport.plannedTasks) {
      context.weeklyReport.plannedTasks = [];
      await context.save();
    }
    
    // Если это первый вход в состояние или нет задач, показываем инструкцию
    if (context.weeklyReport.plannedTasks.length === 0) {
      await this._sendMessage(
        context,
        'Теперь перечислите задачи, которые вы *планируете выполнить на следующей неделе* (включая невыполненные).\n\n' +
        'Отправляйте по одной задаче в сообщении. После каждой отправленной задачи ' +
        'я добавлю её в список.\n\n' +
        'Когда закончите, отправьте команду /done для перехода к следующему шагу.\n\n' +
        'Для отмены создания отчета отправьте /cancel.'
      );
    } else {
      // Иначе показываем текущий список задач
      await this._showCurrentTasks(context);
    }
  }

  /**
   * Обрабатывает сообщение в состоянии добавления задач
   * @param {Object} context - Контекст пользователя
   * @param {Object} message - Сообщение от пользователя
   * @returns {Promise<string|null>} - Следующее состояние или null
   */
  async handleMessage(context, message) {
    // Проверяем наличие текста в сообщении
    if (!message.text) {
      await this._sendMessage(
        context,
        'Пожалуйста, отправьте текстовое описание задачи.'
      );
      return null;
    }

    const text = message.text.trim();

    // Обрабатываем команды
    if (text.startsWith('/')) {
      switch (text.split(' ')[0]) {
        case this.commands.DONE:
        case this.commands.SKIP:
          // Переходим к следующему состоянию
          return config.states.ENTERING_COMMENT;
          
        case this.commands.CANCEL:
          // Отменяем создание отчета
          await this._cancelReport(context);
          return config.states.NONE;
          
        default:
          await this._sendMessage(
            context,
            'Неизвестная команда. Доступные команды:\n' +
            '/done - завершить ввод задач\n' +
            '/cancel - отменить создание отчета'
          );
          return null;
      }
    }

    // Получаем массив задач
    const tasksArray = context.weeklyReport.plannedTasks;
    
    // Проверяем, не превышен ли лимит задач
    if (tasksArray.length >= this.maxTasks) {
      await this._sendMessage(
        context,
        `Вы достигли максимального количества задач (${this.maxTasks}). ` +
        'Отправьте /done для перехода к следующему шагу.'
      );
      return null;
    }

    // Добавляем новую задачу
    tasksArray.push(text);
    await context.save();
    
    logger.info(`Пользователь ${context.userId} добавил задачу в планы: ${text}`);

    // Показываем текущий список задач
    await this._showCurrentTasks(context);
    
    return null;
  }

  /**
   * Показывает текущий список задач
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   * @private
   */
  async _showCurrentTasks(context) {
    const tasks = context.weeklyReport.plannedTasks;
      
    const tasksCount = tasks.length;
    const title = 'Планы на следующую неделю';
    
    let message = `*${title} (${tasksCount}/${this.maxTasks}):*\n\n`;
    
    if (tasksCount > 0) {
      tasks.forEach((task, index) => {
        message += `${index + 1}. ${task}\n`;
      });
      message += '\n';
    } else {
      message += 'Список пуст. Добавьте задачи.\n\n';
    }
    
    message += 'Отправьте еще одну задачу или используйте команду /done, когда закончите.';
    
    await this._sendMessage(context, message);
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

module.exports = new AddingTasksState();