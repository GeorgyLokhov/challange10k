/**
 * Google Sheets Service
 * 
 * Сервис для работы с Google Sheets API
 * Реализует методы для получения и сохранения данных отчетов
 */

const { google } = require('googleapis');
const logger = require('../../utils/logger');
const config = require('../../utils/config');
const CacheManager = require('./cacheManager');
const SheetsErrorHandler = require('./errorHandler');
const WeeklyReport = require('./models/WeeklyReport');
const UserStats = require('./models/UserStats');

class GoogleSheetsService {
  /**
   * Создает новый экземпляр сервиса Google Sheets
   */
  constructor() {
    this.initialized = false;
    this.auth = null;
    this.sheetsClient = null;
    this.spreadsheetId = config.google.spreadsheetId;
    this.errorHandler = new SheetsErrorHandler();
    this.cache = new CacheManager();
  }

  /**
   * Инициализирует сервис Google Sheets
   * @returns {Promise<boolean>} - Результат инициализации
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      // Создаем JWT клиент для авторизации с помощью сервисного аккаунта
      logger.info('Используемая конфигурация Google:', {
        spreadsheetId: this.spreadsheetId,
        credentials_exist: !!config.google.credentials,
        reportsSheet: config.google.reportsSheet,
        usersSheet: config.google.usersSheet,
      });
      this.auth = new google.auth.JWT(
        config.google.credentials.client_email,
        null,
        config.google.credentials.private_key.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/spreadsheets']
      );

      // Создаем клиент Sheets API
      this.sheetsClient = google.sheets({ version: 'v4', auth: this.auth });

      // Проверяем доступ к таблице
      await this._testConnection();

      logger.info('Google Sheets сервис успешно инициализирован');
      this.initialized = true;
      return true;
    } catch (error) {
      logger.error(`Ошибка при инициализации Google Sheets сервиса: ${error.message}`, error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Получает данные из указанного диапазона в таблице
   * @param {string} range - Диапазон в формате A1 (например, 'Sheet1!A1:B10')
   * @param {boolean} [forceRefresh=false] - Принудительное обновление данных, игнорируя кэш
   * @returns {Promise<Array<Array<string>>>} - Данные из указанного диапазона
   */
  async getData(range, forceRefresh = false) {
    await this._ensureInitialized();

    const cacheKey = `sheets_${this.spreadsheetId}_${range}`;
    
    // Проверяем кэш, если не требуется принудительное обновление
    if (!forceRefresh) {
      const cachedData = await this.cache.get(cacheKey);
      if (cachedData) {
        logger.debug(`Получены данные из кэша для диапазона: ${range}`);
        return cachedData;
      }
    }

    // Запрашиваем данные из API с обработкой ошибок и повторными попытками
    const result = await this.errorHandler.withRetry(async () => {
      const response = await this.sheetsClient.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'FORMATTED_STRING'
      });
      return response.data.values || [];
    });

    // Сохраняем результат в кэш на 5 минут
    await this.cache.set(cacheKey, result, 300);
    
    logger.debug(`Получены данные из API для диапазона: ${range}`);
    return result;
  }

  /**
   * Сохраняет данные в указанный диапазон таблицы
   * @param {string} range - Диапазон в формате A1
   * @param {Array<Array<any>>} values - Данные для сохранения
   * @returns {Promise<Object>} - Результат операции
   */
  async updateData(range, values) {
    await this._ensureInitialized();

    // Обновляем данные с обработкой ошибок и повторными попытками
    const result = await this.errorHandler.withRetry(async () => {
      const response = await this.sheetsClient.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: values
        }
      });
      return response.data;
    });

    // Инвалидируем кэш для обновленного диапазона
    const cacheKey = `sheets_${this.spreadsheetId}_${range}`;
    await this.cache.delete(cacheKey);
    
    logger.info(`Обновлены данные в диапазоне: ${range}`);
    return result;
  }

  /**
   * Добавляет данные в конец указанного листа
   * @param {string} range - Диапазон в формате A1, например 'Sheet1!A:Z'
   * @param {Array<Array<any>>} values - Данные для добавления
   * @returns {Promise<Object>} - Результат операции
   */
  async appendData(range, values) {
    await this._ensureInitialized();

    // Добавляем данные с обработкой ошибок и повторными попытками
    const result = await this.errorHandler.withRetry(async () => {
      const response = await this.sheetsClient.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: values
        }
      });
      return response.data;
    });

    // Инвалидируем кэш для обновленного листа
    const sheetName = range.split('!')[0];
    const cacheKeyPattern = `sheets_${this.spreadsheetId}_${sheetName}`;
    await this.cache.deleteByPattern(cacheKeyPattern);
    
    logger.info(`Добавлены данные в диапазон: ${range}`);
    return result;
  }

  /**
   * Получает еженедельные отчеты пользователя
   * @param {number} userId - ID пользователя Telegram
   * @param {number} [limit=10] - Лимит количества отчетов
   * @returns {Promise<Array<WeeklyReport>>} - Список объектов отчетов
   */
  async getUserReports(userId, limit = 10) {
    await this._ensureInitialized();
    
    const range = `${config.google.reportsSheet}!A:G`;
    const data = await this.getData(range);
    
    const reports = data
      .filter(row => row[1] === userId)
      .slice(-limit)
      .map(row => new WeeklyReport({
        id: row[0],
        userId: row[1],
        date: row[2],
        status: row[3],
        completedTasks: row[4] ? row[4].split(';') : [],
        plannedTasks: row[5] ? row[5].split(';') : [],
        comment: row[6] || ''
      }));
    
    return reports;
  }

  /**
   * Сохраняет еженедельный отчет пользователя
   * @param {WeeklyReport} report - Объект отчета для сохранения
   * @returns {Promise<Object>} - Результат операции
   */
  async saveReport(report) {
    await this._ensureInitialized();
    
    const values = [[
      report.id,
      report.userId,
      report.date,
      report.status,
      report.completedTasks.join(';'),
      report.plannedTasks.join(';'),
      report.comment
    ]];
    
    const range = `${config.google.reportsSheet}!A:G`;
    const result = await this.appendData(range, values);
    
    // Обновляем статистику пользователя
    await this.updateUserStats(report.userId, {
      lastReportDate: report.date,
      reportsCount: 1, // Инкрементируем счетчик отчетов на 1
      completedTasksCount: report.completedTasks.length,
      plannedTasksCount: report.plannedTasks.length
    });
    
    return result;
  }

  /**
   * Получает статистику пользователя
   * @param {number} userId - ID пользователя Telegram
   * @returns {Promise<UserStats|null>} - Объект статистики или null, если пользователь не найден
   */
  async getUserStats(userId) {
    await this._ensureInitialized();
    
    const range = `${config.google.usersSheet}!A:G`;
    const data = await this.getData(range);
    
    const userRow = data.find(row => row[0] === userId);
    if (!userRow) {
      return null;
    }
    
    return new UserStats({
      userId: userRow[0],
      username: userRow[1],
      firstName: userRow[2],
      lastName: userRow[3],
      registrationDate: userRow[4],
      lastReportDate: userRow[5],
      reportsCount: parseInt(userRow[6] || '0', 10),
      completedTasksCount: parseInt(userRow[7] || '0', 10),
      plannedTasksCount: parseInt(userRow[8] || '0', 10)
    });
  }

  /**
   * Создает или обновляет статистику пользователя
   * @param {number} userId - ID пользователя Telegram
   * @param {Object} updateData - Данные для обновления
   * @returns {Promise<Object>} - Результат операции
   */
  async updateUserStats(userId, updateData = {}) {
    await this._ensureInitialized();
    
    // Получаем текущую статистику пользователя или создаем новую запись
    let userStats = await this.getUserStats(userId);
    
    if (!userStats) {
      // Если пользователь не найден, создаем новую запись
      userStats = new UserStats({
        userId: userId,
        registrationDate: new Date().toISOString(),
        reportsCount: 0,
        completedTasksCount: 0,
        plannedTasksCount: 0
      });
    }
    
    // Обновляем поля статистики
    Object.entries(updateData).forEach(([key, value]) => {
      if (key in userStats && key !== 'userId') {
        if (['reportsCount', 'completedTasksCount', 'plannedTasksCount'].includes(key)) {
          // Для числовых полей выполняем инкремент
          userStats[key] += value;
        } else {
          // Для остальных полей присваиваем новое значение
          userStats[key] = value;
        }
      }
    });
    
    // Получаем все записи пользователей
    const range = `${config.google.usersSheet}!A:I`;
    const data = await this.getData(range);
    
    // Ищем индекс пользователя в данных
    const userIndex = data.findIndex(row => row[0] === userId);
    
    if (userIndex === -1) {
      // Если пользователь не найден, добавляем новую запись
      const values = [[
        userStats.userId,
        userStats.username || '',
        userStats.firstName || '',
        userStats.lastName || '',
        userStats.registrationDate,
        userStats.lastReportDate || '',
        userStats.reportsCount,
        userStats.completedTasksCount,
        userStats.plannedTasksCount
      ]];
      
      return await this.appendData(`${config.google.usersSheet}!A:I`, values);
    } else {
      // Если пользователь найден, обновляем существующую запись
      // Индекс в таблице начинается с 1, а не с 0
      const rowNumber = userIndex + 1;
      const values = [[
        userStats.userId,
        userStats.username || '',
        userStats.firstName || '',
        userStats.lastName || '',
        userStats.registrationDate,
        userStats.lastReportDate || '',
        userStats.reportsCount,
        userStats.completedTasksCount,
        userStats.plannedTasksCount
      ]];
      
      return await this.updateData(`${config.google.usersSheet}!A${rowNumber}:I${rowNumber}`, values);
    }
  }

  /**
   * Проверяет соединение с Google Sheets API
   * @returns {Promise<boolean>} - true, если соединение установлено
   * @private
   */
  async _testConnection() {
    try {
      // Пытаемся получить метаданные таблицы
      const response = await this.sheetsClient.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      
      logger.info(`Успешное соединение с таблицей: ${response.data.properties.title}`);
      return true;
    } catch (error) {
      logger.error(`Ошибка соединения с Google Sheets API: ${error.message}`, error);
      throw new Error(`Ошибка соединения с Google Sheets API: ${error.message}`);
    }
  }

  /**
   * Проверяет, что сервис инициализирован
   * @returns {Promise<void>}
   * @private
   */
  async _ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.initialized) {
      throw new Error('Google Sheets сервис не инициализирован');
    }
  }
}

// Экспортируем singleton
module.exports = new GoogleSheetsService(); 