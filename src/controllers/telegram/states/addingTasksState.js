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
    
    // Инициализируем массив невыполненных задач, если его нет
    if (!context.weeklyReport.incompleteTasks) {
      context.weeklyReport.incompleteTasks = [];
      await context.save();
    }
    
    // Если это первый вход в состояние или нет задач, показываем инструкцию
    if (context.weeklyReport.incompleteTasks.length === 0) {
      await this._sendMessage(
        context,
        'Теперь перечислите задачи, которые вы *не успели выполнить* за прошедшую неделю.\n\n' +
        'Отправляйте по одной задаче в сообщении. После каждой отправленной задачи ' +
        'я добавлю её в список.\n\n' +
        'Когда закончите, отправьте команду /done для перехода к следующему шагу.\n\n' +
        'Если у вас нет невыполненных задач, отправьте /skip для пропуска этого шага.\n\n' +
        'Для отмены создания отчета отправьте /cancel.'
      );
    } else {
      // Иначе показываем текущий список невыполненных задач
      await this._showCurrentTasks(context, 'incompleteTasks');
    }
  }

  /**
   * Обрабатывает сообщение в состоянии добавления задач
   * @param {Object} context - Контекст пользователя
   * @param {Object} message - Сообщение от пользователя
   * @returns {Promise<string|null>} - Следующее состояние или null
   */
  async handleMessage(context, message) {
    // Определяем, в какой фазе находится пользователь (добавление невыполненных задач или планов)
    const currentPhase = context.taskPhase || 'incompleteTasks';
    
    // Проверяем наличие текста в сообщении
    if (!message.text) {
      await this._sendMessage(
        context, 
        currentPhase === 'incompleteTasks' 
          ? 'Пожалуйста, отправьте текстовое описание невыполненной задачи.'
          : 'Пожалуйста, отправьте текстовое описание задачи на следующую неделю.'
      );
      return null;
    }

    const text = message.text.trim();

    // Обрабатываем команды
    if (text.startsWith('/')) {
      switch (text.split(' ')[0]) {
        case this.commands.DONE:
          // Если мы в фазе невыполненных задач, переходим к планам
          if (currentPhase === 'incompleteTasks') {
            // Переходим к фазе добавления планов на следующую неделю
            context.taskPhase = 'nextWeekPlans';
            await context.save();
            
            // Инициализируем массив планов, если его нет
            if (!context.weeklyReport.nextWeekPlans) {
              context.weeklyReport.nextWeekPlans = [];
              await context.save();
            }
            
            // Показываем инструкцию для добавления планов
            await this._sendMessage(
              context,
              'Теперь перечислите задачи, которые вы *планируете выполнить на следующей неделе*.\n\n' +
              'Отправляйте по одной задаче в сообщении. После каждой отправленной задачи ' +
              'я добавлю её в список.\n\n' +
              'Когда закончите, отправьте команду /done для перехода к следующему шагу.\n\n' +
              'Если у вас нет планов на следующую неделю, отправьте /skip для пропуска этого шага.\n\n' +
              'Для отмены создания отчета отправьте /cancel.'
            );
            return null;
          } else {
            // Если мы в фазе планов, переходим к следующему состоянию
            delete context.taskPhase;
            await context.save();
            return config.states.ENTERING_COMMENT;
          }
          
        case this.commands.SKIP:
          // Пропускаем текущую фазу
          if (currentPhase === 'incompleteTasks') {
            // Переходим к фазе добавления планов
            context.taskPhase = 'nextWeekPlans';
            await context.save();
            
            // Инициализируем массив планов, если его нет
            if (!context.weeklyReport.nextWeekPlans) {
              context.weeklyReport.nextWeekPlans = [];
              await context.save();
            }
            
            await this._sendMessage(
              context,
              'Вы пропустили добавление невыполненных задач.\n\n' +
              'Теперь перечислите задачи, которые вы *планируете выполнить на следующей неделе*.\n\n' +
              'Отправляйте по одной задаче в сообщении или отправьте /done, когда закончите.\n' +
              'Для пропуска этого шага отправьте /skip.'
            );
            return null;
          } else {
            // Пропускаем добавление планов и переходим к следующему состоянию
            delete context.taskPhase;
            await context.save();
            return config.states.ENTERING_COMMENT;
          }
          
        case this.commands.CANCEL:
          // Отменяем создание отчета
          await this._cancelReport(context);
          return config.states.NONE;
          
        default:
          await this._sendMessage(
            context,
            'Неизвестная команда. Доступные команды:\n' +
            '/done - завершить ввод текущих задач\n' +
            '/skip - пропустить текущий шаг\n' +
            '/cancel - отменить создание отчета'
          );
          return null;
      }
    }

    // Получаем правильный массив задач в зависимости от текущей фазы
    const tasksArray = currentPhase === 'incompleteTasks' 
      ? context.weeklyReport.incompleteTasks 
      : context.weeklyReport.nextWeekPlans;
    
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
    
    logger.info(`Пользователь ${context.userId} добавил ${currentPhase === 'incompleteTasks' ? 'невыполненную задачу' : 'план'}: ${text}`);

    // Показываем текущий список задач
    await this._showCurrentTasks(context, currentPhase);
    
    return null;
  }

  /**
   * Показывает текущий список задач
   * @param {Object} context - Контекст пользователя
   * @param {string} taskType - Тип задач ('incompleteTasks' или 'nextWeekPlans')
   * @returns {Promise<void>}
   * @private
   */
  async _showCurrentTasks(context, taskType) {
    const tasks = taskType === 'incompleteTasks' 
      ? context.weeklyReport.incompleteTasks 
      : context.weeklyReport.nextWeekPlans;
      
    const tasksCount = tasks.length;
    const title = taskType === 'incompleteTasks' 
      ? 'Список невыполненных задач' 
      : 'Планы на следующую неделю';
    
    let message = `*${title} (${tasksCount}/${this.maxTasks}):*\n\n`;
    
    if (tasksCount > 0) {
      tasks.forEach((task, index) => {
        message += `${index + 1}. ${task}\n`;
      });
      message += '\n';
    } else {
      message += `Список пуст. Добавьте ${taskType === 'incompleteTasks' ? 'невыполненные задачи' : 'планы на следующую неделю'}.\n\n`;
    }
    
    message += 'Отправьте еще одну задачу или используйте команды:\n' +
               '/done - перейти к следующему шагу\n' +
               '/skip - пропустить текущий шаг\n' +
               '/cancel - отменить создание отчета';
    
    await this._sendMessage(context, message);
  }

  /**
   * Отменяет создание отчета
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   * @private
   */
  async _cancelReport(context) {
    // Удаляем отчет и фазу из контекста
    delete context.weeklyReport;
    delete context.taskPhase;
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