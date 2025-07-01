/**
 * SheetsErrorHandler
 * 
 * Обработчик ошибок для Google Sheets API
 * Реализует механизм повторных попыток с экспоненциальной задержкой
 * и корректную обработку различных типов ошибок API
 */

const logger = require('../../utils/logger');

// Константы для повторных попыток
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_RETRY_BACKOFF_FACTOR = 2;

// Коды ошибок, для которых имеет смысл повторять запрос
const RETRYABLE_ERROR_CODES = [
  429, // Too Many Requests - превышен лимит запросов
  500, // Internal Server Error - внутренняя ошибка сервера
  502, // Bad Gateway - проблема с шлюзом
  503, // Service Unavailable - сервис недоступен
  504  // Gateway Timeout - таймаут шлюза
];

class SheetsErrorHandler {
  /**
   * Создает новый экземпляр обработчика ошибок
   * @param {Object} options - Опции обработчика
   * @param {number} options.maxRetries - Максимальное количество повторных попыток
   * @param {number} options.retryDelayMs - Начальная задержка между попытками (мс)
   * @param {number} options.retryBackoffFactor - Фактор экспоненциального увеличения задержки
   */
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.retryDelayMs = options.retryDelayMs || DEFAULT_RETRY_DELAY_MS;
    this.retryBackoffFactor = options.retryBackoffFactor || DEFAULT_RETRY_BACKOFF_FACTOR;
  }

  /**
   * Выполняет функцию с механизмом повторных попыток
   * @param {Function} fn - Функция для выполнения
   * @param {number} [retries=0] - Текущее количество повторных попыток
   * @returns {Promise<any>} - Результат выполнения функции
   * @throws {Error} - Ошибка после всех попыток
   */
  async withRetry(fn, retries = 0) {
    try {
      return await fn();
    } catch (error) {
      // Если превысили максимальное количество попыток, выбрасываем ошибку
      if (retries >= this.maxRetries) {
        logger.error(`Превышено максимальное количество попыток (${this.maxRetries}): ${error.message}`, error);
        throw this.formatError(error);
      }

      // Проверяем, можно ли повторить запрос для данной ошибки
      if (!this.isRetryable(error)) {
        logger.error(`Неповторяемая ошибка: ${error.message}`, error);
        throw this.formatError(error);
      }

      // Рассчитываем задержку для следующей попытки
      const delay = this.calculateRetryDelay(retries);
      
      logger.info(`Повторная попытка ${retries + 1}/${this.maxRetries} через ${delay}мс: ${error.message}`);
      
      // Ждем перед следующей попыткой
      await this.sleep(delay);
      
      // Рекурсивно повторяем попытку
      return this.withRetry(fn, retries + 1);
    }
  }

  /**
   * Проверяет, можно ли повторить запрос для данной ошибки
   * @param {Error} error - Ошибка для проверки
   * @returns {boolean} - true, если ошибка позволяет повторить запрос
   * @private
   */
  isRetryable(error) {
    // Проверяем наличие ответа с кодом ошибки
    if (error.response && error.response.status) {
      return RETRYABLE_ERROR_CODES.includes(error.response.status);
    }

    // Проверяем наличие кода ошибки в данных ответа
    if (error.code) {
      // Обрабатываем специфичные коды ошибок Google API
      switch (error.code) {
        case 'ECONNRESET':
        case 'ETIMEDOUT':
        case 'ESOCKETTIMEDOUT':
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
          return true;
          
        case 'INVALID_ARGUMENT':
        case 'NOT_FOUND':
        case 'PERMISSION_DENIED':
          return false;
          
        default:
          // По умолчанию для сетевых ошибок разрешаем повторные попытки
          return error.code.startsWith('E');
      }
    }
    
    // Проверяем, связана ли ошибка с превышением лимитов запросов
    if (error.message && 
       (error.message.includes('quota') || 
        error.message.includes('rate limit') || 
        error.message.includes('timeout'))) {
      return true;
    }
    
    // По умолчанию не повторяем запрос
    return false;
  }

  /**
   * Рассчитывает задержку для следующей попытки
   * @param {number} retries - Текущее количество попыток
   * @returns {number} - Задержка в миллисекундах
   * @private
   */
  calculateRetryDelay(retries) {
    // Экспоненциальная задержка с небольшим случайным компонентом
    const baseDelay = this.retryDelayMs * Math.pow(this.retryBackoffFactor, retries);
    const jitter = Math.random() * 0.3 * baseDelay; // Случайный компонент до 30%
    
    return Math.floor(baseDelay + jitter);
  }

  /**
   * Ожидает указанное количество миллисекунд
   * @param {number} ms - Миллисекунды для ожидания
   * @returns {Promise<void>} - Promise, который резолвится через указанное время
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Форматирует ошибку для выброса
   * @param {Error} error - Исходная ошибка
   * @returns {Error} - Отформатированная ошибка
   * @private
   */
  formatError(error) {
    // Если это ошибка API с подробностями в response
    if (error.response && error.response.data) {
      const apiError = new Error(
        `Google Sheets API Error: ${error.response.status} - ${error.response.statusText}`
      );
      
      apiError.status = error.response.status;
      apiError.details = error.response.data;
      apiError.originalError = error;
      
      return apiError;
    }
    
    // Если это ошибка с кодом от Google API
    if (error.code && error.errors) {
      const apiError = new Error(`Google Sheets API Error: ${error.code} - ${error.message}`);
      apiError.code = error.code;
      apiError.details = error.errors;
      apiError.originalError = error;
      
      return apiError;
    }
    
    // Возвращаем исходную ошибку, если её формат неизвестен
    return error;
  }
}

module.exports = SheetsErrorHandler; 