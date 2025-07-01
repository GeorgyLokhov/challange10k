/**
 * Менеджер пользовательских сессий для телеграм-бота
 * Управляет контекстами пользователей и их состояниями
 */

const logger = require('../../utils/logger');

class SessionManager {
  /**
   * Создает новый экземпляр менеджера сессий
   * @param {Object} options - Опции менеджера сессий
   * @param {Object} options.telegram - Клиент Telegram API
   * @param {function} options.saveSession - Функция для сохранения сессии
   * @param {function} options.loadSession - Функция для загрузки сессии
   */
  constructor(options = {}) {
    this.telegram = options.telegram;
    this.saveSession = options.saveSession || this._defaultSaveSession;
    this.loadSession = options.loadSession || this._defaultLoadSession;
    
    // Хранилище сессий в памяти (используется по умолчанию)
    this.sessions = new Map();
    
    logger.info('Менеджер сессий инициализирован');
  }

  /**
   * Получает контекст пользователя из обновления Telegram
   * @param {Object} update - Объект обновления от Telegram
   * @returns {Promise<Object|null>} - Контекст пользователя или null, если не удалось определить пользователя
   */
  async getContextFromUpdate(update) {
    const userId = this._getUserIdFromUpdate(update);
    
    if (!userId) {
      logger.warn('Не удалось определить ID пользователя из обновления');
      return null;
    }
    
    return await this.getContext(userId);
  }

  /**
   * Получает контекст пользователя по его ID
   * @param {string|number} userId - ID пользователя
   * @returns {Promise<Object>} - Контекст пользователя
   */
  async getContext(userId) {
    userId = String(userId);
    
    // Проверяем, есть ли уже контекст в памяти
    if (this.sessions.has(userId)) {
      return this.sessions.get(userId);
    }
    
    // Пытаемся загрузить контекст из хранилища
    let context = await this.loadSession(userId);
    
    // Если контекст не найден, создаем новый
    if (!context) {
      context = this._createContext(userId);
    }
    
    // Добавляем ссылку на клиент Telegram и функцию сохранения
    context.telegram = this.telegram;
    context.save = () => this.saveContext(userId, context);
    
    // Сохраняем контекст в памяти
    this.sessions.set(userId, context);
    
    return context;
  }

  /**
   * Сохраняет контекст пользователя
   * @param {string|number} userId - ID пользователя
   * @param {Object} context - Контекст пользователя для сохранения
   * @returns {Promise<boolean>} - Результат сохранения
   */
  async saveContext(userId, context) {
    userId = String(userId);
    
    // Обновляем контекст в памяти
    this.sessions.set(userId, context);
    
    // Создаем копию контекста для сохранения, удаляя ссылки на объекты
    const contextForSave = { ...context };
    delete contextForSave.telegram;
    delete contextForSave.save;
    
    try {
      // Сохраняем контекст во внешнем хранилище
      await this.saveSession(userId, contextForSave);
      return true;
    } catch (error) {
      logger.error(`Ошибка при сохранении контекста пользователя ${userId}: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Удаляет контекст пользователя
   * @param {string|number} userId - ID пользователя
   * @returns {Promise<boolean>} - Результат удаления
   */
  async clearContext(userId) {
    userId = String(userId);
    
    // Удаляем контекст из памяти
    this.sessions.delete(userId);
    
    try {
      // Реализация зависит от способа хранения сессий
      // В данном случае, просто сохраняем пустой контекст
      await this.saveSession(userId, null);
      return true;
    } catch (error) {
      logger.error(`Ошибка при удалении контекста пользователя ${userId}: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Извлекает ID пользователя из обновления Telegram
   * @param {Object} update - Объект обновления от Telegram
   * @returns {string|null} - ID пользователя или null, если не удалось определить
   * @private
   */
  _getUserIdFromUpdate(update) {
    if (!update) return null;
    
    // Определяем ID пользователя из разных типов обновлений
    if (update.message) {
      return String(update.message.from.id);
    } else if (update.callback_query) {
      return String(update.callback_query.from.id);
    } else if (update.edited_message) {
      return String(update.edited_message.from.id);
    } else if (update.inline_query) {
      return String(update.inline_query.from.id);
    } else if (update.chosen_inline_result) {
      return String(update.chosen_inline_result.from.id);
    }
    
    return null;
  }

  /**
   * Создает новый контекст пользователя
   * @param {string} userId - ID пользователя
   * @returns {Object} - Новый контекст пользователя
   * @private
   */
  _createContext(userId) {
    return {
      userId,
      state: null,
      data: {},
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };
  }

  /**
   * Функция сохранения сессии по умолчанию (в памяти)
   * @param {string} userId - ID пользователя
   * @param {Object} context - Контекст для сохранения
   * @returns {Promise<void>}
   * @private
   */
  async _defaultSaveSession(userId, context) {
    // По умолчанию ничего не делаем, т.к. сессии уже хранятся в памяти
    return Promise.resolve();
  }

  /**
   * Функция загрузки сессии по умолчанию (из памяти)
   * @param {string} userId - ID пользователя
   * @returns {Promise<Object|null>} - Загруженный контекст или null
   * @private
   */
  async _defaultLoadSession(userId) {
    // По умолчанию возвращаем null, т.к. это первая загрузка
    return Promise.resolve(null);
  }
}

module.exports = SessionManager; 