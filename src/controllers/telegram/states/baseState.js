/**
 * Базовый класс состояния для машины состояний телеграм-бота
 * Определяет интерфейс и общие методы для всех состояний
 */

class BaseState {
  /**
   * Создает новый экземпляр базового состояния
   * @param {string} name - Имя состояния
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * Входит в состояние
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   */
  async enter(context) {
    // Реализация в дочерних классах
  }

  /**
   * Обрабатывает сообщение в текущем состоянии
   * @param {Object} context - Контекст пользователя
   * @param {Object} message - Сообщение от пользователя
   * @returns {Promise<Object|null>} - Следующее состояние или null если состояние не меняется
   */
  async handleMessage(context, message) {
    // Реализация в дочерних классах
    throw new Error('Метод handleMessage должен быть реализован в дочернем классе');
  }

  /**
   * Обрабатывает коллбэк-запросы (нажатия на инлайн кнопки)
   * @param {Object} context - Контекст пользователя
   * @param {Object} query - Данные коллбэк-запроса
   * @returns {Promise<Object|null>} - Следующее состояние или null если состояние не меняется
   */
  async handleCallbackQuery(context, query) {
    // По умолчанию не обрабатываем коллбэки в базовом классе
    return null;
  }

  /**
   * Выходит из состояния
   * @param {Object} context - Контекст пользователя
   * @returns {Promise<void>}
   */
  async exit(context) {
    // Реализация в дочерних классах
  }

  /**
   * Проверяет, может ли состояние обработать команду
   * @param {string} command - Команда (например, /start, /help)
   * @returns {boolean} true, если состояние может обработать команду
   */
  canHandleCommand(command) {
    // По умолчанию состояния не обрабатывают команды
    return false;
  }
  
  /**
   * Отправляет текстовое сообщение пользователю
   * @param {Object} context - Контекст пользователя
   * @param {string} text - Текст сообщения
   * @param {Object} [options] - Дополнительные опции для сообщения
   * @returns {Promise<Object>} - Результат отправки сообщения
   * @protected
   */
  async _sendMessage(context, text, options = {}) {
    return await context.telegram.sendMessage(context.userId, text, {
      parse_mode: 'Markdown',
      ...options
    });
  }
  
  /**
   * Отправляет сообщение с клавиатурой из кнопок
   * @param {Object} context - Контекст пользователя
   * @param {string} text - Текст сообщения
   * @param {Array<Array<Object>>} keyboard - Массив кнопок клавиатуры
   * @param {Object} [options] - Дополнительные опции для сообщения
   * @returns {Promise<Object>} - Результат отправки сообщения
   * @protected
   */
  async _sendMessageWithKeyboard(context, text, keyboard, options = {}) {
    return await context.telegram.sendMessage(context.userId, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard,
        resize_keyboard: true,
        one_time_keyboard: false
      },
      ...options
    });
  }
  
  /**
   * Отправляет сообщение с инлайн-клавиатурой
   * @param {Object} context - Контекст пользователя
   * @param {string} text - Текст сообщения
   * @param {Array<Array<Object>>} inline_keyboard - Массив кнопок инлайн-клавиатуры
   * @param {Object} [options] - Дополнительные опции для сообщения
   * @returns {Promise<Object>} - Результат отправки сообщения
   * @protected
   */
  async _sendInlineKeyboard(context, text, inline_keyboard, options = {}) {
    return await context.telegram.sendMessage(context.userId, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard
      },
      ...options
    });
  }
  
  /**
   * Отвечает на коллбэк-запрос
   * @param {Object} context - Контекст пользователя
   * @param {string} callbackQueryId - ID коллбэк-запроса
   * @param {Object} [options] - Опции ответа
   * @returns {Promise<Object>} - Результат ответа
   * @protected
   */
  async _answerCallbackQuery(context, callbackQueryId, options = {}) {
    return await context.telegram.answerCallbackQuery(callbackQueryId, options);
  }
}

module.exports = BaseState; 