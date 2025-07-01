/**
 * Состояние отметки выполненных задач
 * Позволяет пользователю отметить, какие задачи он выполнил за неделю
 */

const BaseState = require('./baseState');
const config = require('../../../utils/config');
const logger = require('../../../utils/logger');
const sheetsService = require('../../../services/sheets');

class MarkingTasksState extends BaseState {
  /**
   * Создает экземпляр состояния отметки задач
   */
  constructor() {
    super(config.states.MARKING_TASKS);
    
    // Максимальное количество задач
    this.maxTasks = 15;
    
    // Команды для управления списком задач
    this.commands = {
      ADD: '/add',
      DONE: '/done',
      CANCEL: '/cancel'
    };
  }

  /**
   * Входит в состояние отметки выполненных задач
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   */
  async enter(context) {
    logger.info(`Пользователь ${context.userId} вошел в состояние отметки выполненных задач`);
    
    // Проверяем, есть ли активный отчет
    if (!context.weeklyReport) {
      logger.error(`Пользователь ${context.userId} попал в состояние отметки задач без активного отчета`);
      await this._sendMessage(
        context,
        '❌ Ошибка: отчет не найден. Начните создание отчета заново с помощью команды /report.'
      );
      return;
    }
    
    // Если предыдущие задачи уже были добавлены, покажем их
    if (context.weeklyReport.completedTasks && context.weeklyReport.completedTasks.length > 0) {
      await this._showCurrentTasks(context);
    } else {
      // Инициализируем массивы задач, если их нет
      context.weeklyReport.completedTasks = [];
      await context.save();
      
      // Отправляем инструкцию по добавлению задач
      await this._sendMessage(
        context,
        'Теперь перечислите задачи, которые вы *выполнили* за прошедшую неделю.\n\n' +
        'Отправляйте по одной задаче в сообщении. После каждой отправленной задачи ' +
        'я добавлю её в список.\n\n' +
        'Когда закончите, отправьте команду /done для перехода к следующему шагу.\n\n' +
        'Для отмены создания отчета отправьте /cancel.'
      );
    }
  }

  /**
   * Обрабатывает сообщение в состоянии отметки задач
   * @param {Object} context - Контекст пользователя
   * @param {Object} message - Сообщение от пользователя
   * @returns {Promise<string|null>} - Следующее состояние или null
   */
  async handleMessage(context, message) {
    // Проверяем наличие текста в сообщении
    if (!message.text) {
      await this._sendMessage(
        context, 
        'Пожалуйста, отправьте текстовое описание выполненной задачи.'
      );
      return null;
    }

    const text = message.text.trim();

    // Обрабатываем команды
    if (text.startsWith('/')) {
      switch (text.split(' ')[0]) {
        case this.commands.DONE:
          // Переходим к следующему шагу после завершения ввода выполненных задач
          return config.states.ADDING_TASKS;
          
        case this.commands.CANCEL:
          // Отменяем создание отчета
          await this._cancelReport(context);
          return config.states.NONE;
          
        default:
          await this._sendMessage(
            context,
            'Неизвестная команда. Доступные команды:\n' +
            '/done - завершить ввод выполненных задач\n' +
            '/cancel - отменить создание отчета'
          );
          return null;
      }
    }

    // Проверяем, не превышен ли лимит задач
    if (context.weeklyReport.completedTasks.length >= this.maxTasks) {
      await this._sendMessage(
        context,
        `Вы достигли максимального количества задач (${this.maxTasks}). ` +
        'Отправьте /done для перехода к следующему шагу.'
      );
      return null;
    }

    // Добавляем новую выполненную задачу
    context.weeklyReport.completedTasks.push(text);
    await context.save();
    
    logger.info(`Пользователь ${context.userId} добавил выполненную задачу: ${text}`);

    // Показываем текущий список задач
    await this._showCurrentTasks(context);
    
    return null;
  }

  /**
   * Показывает текущий список выполненных задач
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   * @private
   */
  async _showCurrentTasks(context) {
    const tasks = context.weeklyReport.completedTasks;
    const tasksCount = tasks.length;
    
    let message = `*Список выполненных задач (${tasksCount}/${this.maxTasks}):*\n\n`;
    
    if (tasksCount > 0) {
      tasks.forEach((task, index) => {
        message += `${index + 1}. ${task}\n`;
      });
      message += '\n';
    } else {
      message += 'Список пуст. Добавьте задачи, которые вы выполнили за неделю.\n\n';
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

module.exports = new MarkingTasksState(); 