/**
 * Модуль для обработки ошибок Google Sheets API
 * Содержит логику для обработки различных типов ошибок и повторных попыток
 */

const logger = require('../../utils/logger');

class SheetsErrorHandler {
  /**
   * Максимальное количество повторных попыток
   * @type {number}
   */
  static MAX_RETRIES = 3;
  
  /**
   * Базовая задержка между повторными попытками (мс)
   * @type {number}
   */
  static BASE_DELAY = 1000;

  /**
   * Обработка ошибок Google Sheets API с повторными попытками
   * @param {Function} operation - Асинхронная функция с операцией Google Sheets
   * @param {Object} options - Настройки обработки ошибок
   * @param {number} [options.maxRetries=3] - Максимальное количество повторных попыток
   * @param {number} [options.baseDelay=1000] - Базовая задержка между попытками (мс)
   * @returns {Promise<any>} - Результат операции
   * @throws {Error} - Ошибка после всех попыток
   */
  static async withRetry(operation, options = {}) {
    const maxRetries = options.maxRetries || this.MAX_RETRIES;
    const baseDelay = options.baseDelay || this.BASE_DELAY;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Если это последняя попытка, выходим из цикла
        if (attempt > maxRetries) break;
        
        // Проверяем, можно ли повторить операцию для этой ошибки
        if (!this.isRetryableError(error)) {
          logger.error(`Неповторяемая ошибка Google Sheets API: ${error.message}`, error);
          throw error;
        }
        
        // Экспоненциальная задержка между попытками
        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.warn(
          `Ошибка Google Sheets API (попытка ${attempt}/${maxRetries}). ` +
          `Повторная попытка через ${delay}мс: ${error.message}`
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Логируем ошибку после всех попыток
    logger.error(
      `Все повторные попытки (${maxRetries}) для Google Sheets API не удались: ${lastError.message}`, 
      lastError
    );
    throw lastError;
  }

  /**
   * Проверяет, можно ли повторить операцию для данной ошибки
   * @param {Error} error - Объект ошибки
   * @returns {boolean} - true, если операцию можно повторить
   */
  static isRetryableError(error) {
    // Проверяем код ошибки API Google
    const code = error.code || (error.response && error.response.status);
    
    // Повторяемые HTTP коды ошибок
    const retryableCodes = [
      408, // Request Timeout
      429, // Too Many Requests
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
    ];
    
    // Повторяемые коды ошибок Google API
    const retryableGoogleErrorCodes = [
      'rateLimitExceeded',
      'userRateLimitExceeded',
      'quotaExceeded',
      'backendError',
      'internalError',
    ];
    
    // Повторяемые сетевые ошибки
    const retryableNetworkErrors = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ENETUNREACH',
    ];

    // Проверяем HTTP код ошибки
    if (code && retryableCodes.includes(code)) {
      return true;
    }
    
    // Проверяем код ошибки Google API
    if (error.errors && Array.isArray(error.errors)) {
      for (const err of error.errors) {
        if (err.reason && retryableGoogleErrorCodes.includes(err.reason)) {
          return true;
        }
      }
    }
    
    // Проверяем сетевые ошибки
    if (error.code && retryableNetworkErrors.includes(error.code)) {
      return true;
    }
    
    // По умолчанию не повторяем
    return false;
  }
  
  /**
   * Преобразует ошибку в понятное сообщение
   * @param {Error} error - Объект ошибки
   * @returns {string} - Понятное сообщение об ошибке
   */
  static getErrorMessage(error) {
    if (error.response && error.response.data) {
      const data = error.response.data;
      if (data.error && data.error.message) {
        return `Ошибка Google Sheets: ${data.error.message}`;
      }
    }
    
    return `Ошибка при работе с Google Sheets: ${error.message}`;
  }
}

module.exports = SheetsErrorHandler; 