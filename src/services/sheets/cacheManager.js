/**
 * CacheManager
 * 
 * Менеджер кэширования для данных Google Sheets API
 * Реализует хранение данных в памяти с указанием времени жизни (TTL)
 */

const logger = require('../../utils/logger');

class CacheManager {
  /**
   * Создает новый экземпляр менеджера кэша
   */
  constructor() {
    // Хранилище кэша в формате {key: {value, expires}}
    this.cache = new Map();
    
    // Интервал очистки истекших записей кэша (10 минут)
    this.cleanupInterval = 10 * 60 * 1000;
    
    // Запускаем периодическую очистку кэша
    this._startCleanupInterval();
  }

  /**
   * Получает значение из кэша по ключу
   * @param {string} key - Ключ для получения данных
   * @returns {Promise<any|null>} - Данные из кэша или null, если ключ не найден или значение истекло
   */
  async get(key) {
    const item = this.cache.get(key);
    
    // Если ключ не найден, возвращаем null
    if (!item) {
      return null;
    }
    
    // Проверяем, не истек ли срок жизни кэша
    if (Date.now() > item.expires) {
      // Если истек, удаляем запись и возвращаем null
      this.cache.delete(key);
      return null;
    }
    
    logger.debug(`Получено значение из кэша по ключу: ${key}`);
    return item.value;
  }

  /**
   * Сохраняет значение в кэше с указанным TTL
   * @param {string} key - Ключ для сохранения данных
   * @param {any} value - Значение для сохранения
   * @param {number} ttlSeconds - Время жизни в секундах (по умолчанию 5 минут)
   * @returns {Promise<boolean>} - Результат операции
   */
  async set(key, value, ttlSeconds = 300) {
    try {
      const expires = Date.now() + ttlSeconds * 1000;
      
      this.cache.set(key, {
        value,
        expires
      });
      
      logger.debug(`Сохранено значение в кэше по ключу: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      logger.error(`Ошибка при сохранении в кэш: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Удаляет значение из кэша по ключу
   * @param {string} key - Ключ для удаления
   * @returns {Promise<boolean>} - true, если ключ был удален
   */
  async delete(key) {
    const result = this.cache.delete(key);
    
    if (result) {
      logger.debug(`Удален ключ из кэша: ${key}`);
    }
    
    return result;
  }

  /**
   * Удаляет все значения из кэша, соответствующие шаблону
   * @param {string} pattern - Шаблон ключа (префикс или часть ключа)
   * @returns {Promise<number>} - Количество удаленных ключей
   */
  async deleteByPattern(pattern) {
    let count = 0;
    
    // Находим все ключи, соответствующие шаблону
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      logger.debug(`Удалено ${count} ключей из кэша по шаблону: ${pattern}`);
    }
    
    return count;
  }

  /**
   * Возвращает все ключи, соответствующие шаблону
   * @param {string} pattern - Шаблон ключа (префикс или часть ключа)
   * @returns {Promise<Array<string>>} - Массив найденных ключей
   */
  async keys(pattern) {
    const result = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        result.push(key);
      }
    }
    
    return result;
  }

  /**
   * Очищает весь кэш
   * @returns {Promise<boolean>} - Результат операции
   */
  async clear() {
    try {
      this.cache.clear();
      logger.debug('Кэш полностью очищен');
      return true;
    } catch (error) {
      logger.error(`Ошибка при очистке кэша: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Возвращает количество записей в кэше
   * @returns {Promise<number>} - Количество записей
   */
  async size() {
    return this.cache.size;
  }

  /**
   * Запускает интервал очистки истекших записей кэша
   * @private
   */
  _startCleanupInterval() {
    setInterval(() => {
      this._cleanupExpiredItems();
    }, this.cleanupInterval);
    
    logger.debug(`Запущен интервал очистки кэша (${this.cleanupInterval / 1000}s)`);
  }

  /**
   * Удаляет истекшие записи из кэша
   * @private
   */
  _cleanupExpiredItems() {
    const now = Date.now();
    let count = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      logger.debug(`Автоматически удалено ${count} истекших записей из кэша`);
    }
  }
}

module.exports = CacheManager; 