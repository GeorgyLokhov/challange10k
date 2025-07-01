/**
 * Машина состояний для телеграм-бота
 * Управляет состояниями и переходами между ними
 */

const logger = require('../../utils/logger');
const config = require('../../utils/config');

class StateMachine {
  /**
   * Создает новую машину состояний
   */
  constructor() {
    // Хранилище состояний
    this.states = {};
    
    // Начальное состояние по умолчанию
    this.initialState = config.states.NONE;
  }

  /**
   * Регистрирует состояние в машине состояний
   * @param {Object} state - Объект состояния
   * @returns {StateMachine} - Возвращает this для цепочки вызовов
   */
  registerState(state) {
    if (!state || !state.name) {
      throw new Error('Состояние должно иметь свойство name');
    }
    
    this.states[state.name] = state;
    logger.debug(`Зарегистрировано состояние: ${state.name}`);
    
    return this;
  }

  /**
   * Возвращает состояние по имени
   * @param {string} stateName - Имя состояния
   * @returns {Object} - Объект состояния
   * @throws {Error} - Если состояние не найдено
   */
  getState(stateName) {
    const state = this.states[stateName];
    
    if (!state) {
      throw new Error(`Состояние не найдено: ${stateName}`);
    }
    
    return state;
  }

  /**
   * Проверяет, существует ли состояние с указанным именем
   * @param {string} stateName - Имя состояния
   * @returns {boolean} - true, если состояние существует
   */
  hasState(stateName) {
    return !!this.states[stateName];
  }

  /**
   * Обрабатывает сообщение в текущем контексте пользователя
   * @param {Object} context - Контекст пользователя
   * @param {Object} message - Сообщение от пользователя
   * @returns {Promise<void>}
   */
  async handleMessage(context, message) {
    // Получаем текущее состояние пользователя
    const currentStateName = context.state || this.initialState;
    const currentState = this.getState(currentStateName);
    
    logger.info(`Обработка сообщения для пользователя ${context.userId} в состоянии ${currentStateName}`);
    
    try {
      // Проверяем, является ли сообщение командой
      let nextStateName;
      
      if (message.text && message.text.startsWith('/')) {
        const commandParts = message.text.split(' ');
        const command = commandParts[0].toLowerCase();
        
        // ВАЖНО: Всегда сначала даем текущему состоянию возможность обработать команду,
        // даже если команда не специфична для текущего состояния.
        // Это предотвратит сброс сессии при специфичных командах типа /done
        logger.info(`Обработка команды ${command} в текущем состоянии ${currentStateName}`);
        nextStateName = await currentState.handleMessage(context, message);

        // Только если текущее состояние не обработало команду (вернуло undefined),
        // пытаемся найти другое состояние, которое может обработать эту команду
        if (nextStateName === undefined) {
          // Проверяем, может ли какое-либо другое состояние обработать эту команду
          for (const [stateName, state] of Object.entries(this.states)) {
            if (stateName !== currentStateName && state.canHandleCommand && 
                state.canHandleCommand(command)) {
              logger.info(`Команда ${command} перехвачена состоянием ${stateName}`);
              
              // Если другое состояние может обработать команду, переходим в него
              await this.transition(context, stateName);
              nextStateName = await state.handleMessage(context, message);
              break;
            }
          }
          
          // Если ни одно состояние не может обработать команду,
          // и мы в состоянии отличном от начального, вернемся в начальное
          if (nextStateName === undefined && currentStateName !== this.initialState) {
            logger.info(`Команда ${command} не обработана ни одним состоянием, переход в начальное состояние`);
            await this.transition(context, this.initialState);
            nextStateName = await this.getState(this.initialState).handleMessage(context, message);
          }
        }
      } else {
        // Обычное сообщение обрабатываем в текущем состоянии
        nextStateName = await currentState.handleMessage(context, message);
      }
      
      // Если есть переход в следующее состояние
      if (nextStateName && nextStateName !== currentStateName) {
        await this.transition(context, nextStateName);
      }
    } catch (error) {
      logger.error(`Ошибка при обработке сообщения в состоянии ${currentStateName}: ${error.message}`, error);
      
      // Отправляем пользователю сообщение об ошибке
      try {
        await context.telegram.sendMessage(
          context.userId, 
          'Произошла ошибка при обработке сообщения. Пожалуйста, попробуйте позже.'
        );
      } catch (sendError) {
        logger.error(`Не удалось отправить сообщение об ошибке: ${sendError.message}`);
      }
    }
  }

  /**
   * Обрабатывает коллбэк-запрос (нажатие на инлайн кнопку)
   * @param {Object} context - Контекст пользователя
   * @param {Object} query - Данные коллбэк-запроса
   * @returns {Promise<void>}
   */
  async handleCallbackQuery(context, query) {
    // Получаем текущее состояние пользователя
    const currentStateName = context.state || this.initialState;
    const currentState = this.getState(currentStateName);
    
    logger.info(`Обработка коллбэк-запроса для пользователя ${context.userId} в состоянии ${currentStateName}`);
    
    try {
      // Обрабатываем коллбэк-запрос в текущем состоянии
      const nextStateName = await currentState.handleCallbackQuery(context, query);
      
      // Если есть переход в следующее состояние
      if (nextStateName && nextStateName !== currentStateName) {
        await this.transition(context, nextStateName);
      }
    } catch (error) {
      logger.error(`Ошибка при обработке коллбэк-запроса в состоянии ${currentStateName}: ${error.message}`, error);
      
      // Отвечаем на коллбэк-запрос с сообщением об ошибке
      try {
        await context.telegram.answerCallbackQuery(query.id, {
          text: 'Произошла ошибка. Пожалуйста, попробуйте позже.',
          show_alert: true
        });
      } catch (answerError) {
        logger.error(`Не удалось ответить на коллбэк-запрос: ${answerError.message}`);
      }
    }
  }

  /**
   * Обрабатывает команду
   * @param {Object} context - Контекст пользователя
   * @param {string} command - Команда
   * @param {Object} message - Полное сообщение с командой
   * @returns {Promise<boolean>} - true, если команда была обработана
   */
  async handleCommand(context, command, message) {
    // Проверяем все состояния, которые могут обработать команду
    for (const [stateName, state] of Object.entries(this.states)) {
      if (state.canHandleCommand && state.canHandleCommand(command)) {
        logger.info(`Команда ${command} обработана состоянием ${stateName}`);
        
        // Если текущее состояние не может обработать команду, выполняем переход
        if (context.state !== stateName) {
          await this.transition(context, stateName);
        }
        
        // Обрабатываем сообщение в новом состоянии
        await this.handleMessage(context, message);
        return true;
      }
    }
    
    // Если ни одно состояние не может обработать команду, возвращаемся в начальное состояние
    logger.info(`Команда ${command} не обработана ни одним состоянием, используем начальное состояние`);
    
    // Если пользователь не в начальном состоянии, переходим в него
    if (context.state !== this.initialState) {
      await this.transition(context, this.initialState);
      
      // Обрабатываем сообщение в начальном состоянии
      await this.handleMessage(context, message);
      return true;
    }
    
    return false;
  }

  /**
   * Выполняет переход из текущего состояния в новое
   * @param {Object} context - Контекст пользователя
   * @param {string} newStateName - Имя нового состояния
   * @returns {Promise<void>}
   * @throws {Error} - Если новое состояние не найдено
   */
  async transition(context, newStateName) {
    // Проверяем существование нового состояния
    if (!this.hasState(newStateName)) {
      throw new Error(`Состояние не найдено: ${newStateName}`);
    }
    
    // Получаем текущее и новое состояния
    const currentStateName = context.state || this.initialState;
    const newState = this.getState(newStateName);
    
    logger.info(`Переход для пользователя ${context.userId}: ${currentStateName} -> ${newStateName}`);
    
    // Если текущее состояние существует, вызываем его метод exit
    if (currentStateName !== newStateName && this.hasState(currentStateName)) {
      const currentState = this.getState(currentStateName);
      await currentState.exit(context);
    }
    
    // Устанавливаем новое состояние в контексте
    context.state = newStateName;
    
    // Сохраняем контекст
    if (context.save) {
      await context.save();
    }
    
    // Вызываем метод enter для нового состояния
    await newState.enter(context);
  }

  /**
   * Инициализирует состояние пользователя
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   */
  async initializeState(context) {
    // Если состояние не установлено, устанавливаем начальное состояние
    if (!context.state || !this.hasState(context.state)) {
      context.state = this.initialState;
      
      // Сохраняем контекст
      if (context.save) {
        await context.save();
      }
    }
    
    // Возвращаем текущее состояние
    return this.getState(context.state);
  }
}

module.exports = StateMachine; 