/**
 * Модуль для кэширования данных из Google Sheets
 * Предотвращает частые обращения к API Google Sheets
 */

const NodeCache = require('node-cache');
const config = require('../../utils/config');
const logger = require('../../utils/logger');

class CacheManager {
  constructor() {
    // Инициализация кэша с настройками из конфигурации
    this.cache = new NodeCache({
      stdTTL: config.cache.ttl,
      checkperiod: config.cache.checkPeriod
    });

    logger.info('Кэш-менеджер инициализирован');
  }

  /**
   * Получить данные из кэша
   * @param {string} key - Ключ кэша
   * @returns {any|null} - Данные или null, если кэша нет или он устарел
   */
  async get(key) {
    const value = this.cache.get(key);
    if (value) {
      logger.debug(`Получены данные из кэша: ${key}`);
      return value;
    }
    logger.debug(`Кэш не найден для ключа: ${key}`);
    return null;
  }

  /**
   * Сохранить данные в кэше
   * @param {string} key - Ключ кэша
   * @param {any} value - Данные для сохранения
   * @param {number} [ttl] - Время жизни кэша в секундах (опционально)
   */
  async set(key, value, ttl = config.cache.ttl) {
    this.cache.set(key, value, ttl);
    logger.debug(`Данные сохранены в кэше: ${key} (TTL: ${ttl}с)`);
    return value;
  }

  /**
   * Удалить данные из кэша
   * @param {string} key - Ключ кэша
   */
  async del(key) {
    this.cache.del(key);
    logger.debug(`Данные удалены из кэша: ${key}`);
  }

  /**
   * Очистить весь кэш
   */
  async flush() {
    this.cache.flushAll();
    logger.info('Кэш полностью очищен');
  }

  /**
   * Получить или создать кэш
   * @param {string} key - Ключ кэша
   * @param {Function} fetchFunction - Функция для получения данных, если кэша нет
   * @param {number} [ttl] - Время жизни кэша в секундах (опционально)
   * @returns {Promise<any>} - Данные из кэша или полученные через функцию
   */
  async getOrSet(key, fetchFunction, ttl = config.cache.ttl) {
    const cachedData = await this.get(key);
    if (cachedData !== null) {
      return cachedData;
    }

    logger.debug(`Получение данных через функцию для ключа: ${key}`);
    try {
      const data = await fetchFunction();
      return this.set(key, data, ttl);
    } catch (error) {
      logger.error(`Ошибка при получении данных для кэша: ${key}`, error);
      throw error;
    }
  }
}

module.exports = new CacheManager(); 