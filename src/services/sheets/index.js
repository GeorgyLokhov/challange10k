/**
 * Сервис для работы с Google Sheets API
 * Обеспечивает взаимодействие с таблицей отчетов
 */

const { google } = require('googleapis');
const config = require('../../utils/config');
const logger = require('../../utils/logger');
const cacheManager = require('./cacheManager');
const errorHandler = require('./errorHandler');
const WeeklyReport = require('./models/WeeklyReport');
const UserStats = require('./models/UserStats');

class SheetsService {
  constructor() {
    this.spreadsheetId = config.google.spreadsheetId;
    this.initialized = false;
    this.sheetsClient = null;
    
    // Имена листов в Google Таблице
    this.sheetNames = {
      reports: 'WeeklyReports'
    };
    
    // Заголовки столбцов
    this.headers = [
      'Неделя',
      'Дата',
      'ID пользователя',
      'Имя пользователя',
      'Состояние',
      'Выполненные задачи',
      'Невыполненные задачи',
      'Планы на следующую неделю',
      'Комментарий'
    ];
  }

  /**
   * Инициализирует сервис и проверяет подключение к Google Sheets API
   * @returns {Promise<boolean>} Флаг успешной инициализации
   */
  async initialize() {
    try {
      if (!config.google.credentials) {
        throw new Error('Отсутствуют учетные данные для Google Sheets API');
      }

      // Создаем клиент для аутентификации с учетными данными сервисного аккаунта
      const auth = new google.auth.GoogleAuth({
        credentials: config.google.credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      // Получаем авторизованный клиент
      const authClient = await auth.getClient();
      
      // Создаем экземпляр API Google Sheets
      this.sheetsClient = google.sheets({ 
        version: 'v4', 
        auth: authClient 
      });

      // Проверяем подключение и доступ к таблице
      await this.testConnection();
      
      // Проверяем и создаем необходимые листы и заголовки
      await this.ensureSheetStructure();
      
      this.initialized = true;
      logger.info('Google Sheets API успешно инициализирован');
      return true;
    } catch (error) {
      logger.error(`Ошибка инициализации Google Sheets API: ${error.message}`, error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Проверяет подключение к Google Sheets API и доступ к таблице
   * @returns {Promise<void>}
   */
  async testConnection() {
    try {
      await errorHandler.withRetry(async () => {
        const response = await this.sheetsClient.spreadsheets.get({
          spreadsheetId: this.spreadsheetId
        });
        
        logger.info(`Подключение к таблице установлено: "${response.data.properties.title}"`);
      });
    } catch (error) {
      throw new Error(`Не удалось подключиться к Google Sheets: ${error.message}`);
    }
  }

  /**
   * Проверяет и создает необходимые листы и заголовки
   * @returns {Promise<void>}
   */
  async ensureSheetStructure() {
    try {
      // Получаем список листов
      const response = await this.sheetsClient.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      
      const sheets = response.data.sheets;
      const sheetExists = sheets.some(sheet => 
        sheet.properties.title === this.sheetNames.reports
      );
      
      // Создаем лист, если он не существует
      if (!sheetExists) {
        await this.sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: this.sheetNames.reports
                  }
                }
              }
            ]
          }
        });
        
        logger.info(`Создан новый лист: ${this.sheetNames.reports}`);
      }
      
      // Проверяем наличие заголовков
      await this.ensureHeaders();
      
    } catch (error) {
      throw new Error(`Ошибка при настройке структуры таблицы: ${error.message}`);
    }
  }

  /**
   * Проверяет и добавляет заголовки в лист с отчетами
   * @returns {Promise<void>}
   */
  async ensureHeaders() {
    try {
      // Получаем первую строку
      const response = await this.sheetsClient.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetNames.reports}!A1:I1`
      });
      
      // Если заголовки отсутствуют или неполные, добавляем их
      if (!response.data.values || response.data.values[0].length !== this.headers.length) {
        await this.sheetsClient.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetNames.reports}!A1:I1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [this.headers]
          }
        });
        
        // Форматируем заголовки (жирный шрифт и закрепление)
        await this.sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId: this.getSheetId(this.sheetNames.reports),
                    startRowIndex: 0,
                    endRowIndex: 1
                  },
                  cell: {
                    userEnteredFormat: {
                      textFormat: {
                        bold: true
                      }
                    }
                  },
                  fields: 'userEnteredFormat.textFormat.bold'
                }
              },
              {
                updateSheetProperties: {
                  properties: {
                    sheetId: this.getSheetId(this.sheetNames.reports),
                    gridProperties: {
                      frozenRowCount: 1
                    }
                  },
                  fields: 'gridProperties.frozenRowCount'
                }
              }
            ]
          }
        });
        
        logger.info('Заголовки добавлены и отформатированы');
      }
    } catch (error) {
      logger.error(`Ошибка при проверке/добавлении заголовков: ${error.message}`, error);
    }
  }

  /**
   * Получает ID листа по его имени
   * @param {string} sheetName - Имя листа
   * @returns {number|null} ID листа или null, если лист не найден
   */
  async getSheetId(sheetName) {
    try {
      const response = await this.sheetsClient.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      
      const sheet = response.data.sheets.find(s => 
        s.properties.title === sheetName
      );
      
      return sheet ? sheet.properties.sheetId : null;
    } catch (error) {
      logger.error(`Ошибка при получении ID листа: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Сохраняет еженедельный отчет в Google Sheets
   * @param {WeeklyReport|Object} reportData - Данные отчета
   * @returns {Promise<boolean>} Результат операции
   */
  async saveReport(reportData) {
    try {
      // Убеждаемся, что сервис инициализирован
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Преобразуем данные в экземпляр WeeklyReport, если необходимо
      const report = reportData instanceof WeeklyReport 
        ? reportData 
        : new WeeklyReport(reportData);
      
      // Получаем строку для записи в таблицу
      const rowValues = report.toSheetRow();
      
      // Записываем данные в таблицу с повторными попытками
      await errorHandler.withRetry(async () => {
        await this.sheetsClient.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetNames.reports}!A:I`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [rowValues]
          }
        });
      });
      
      // Очищаем кэш после добавления новых данных
      await this.invalidateCache();
      
      logger.info(`Отчет успешно сохранен для пользователя ${report.userId}, неделя ${report.weekNumber}`);
      return true;
    } catch (error) {
      logger.error(`Ошибка при сохранении отчета: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Получает последний отчет пользователя
   * @param {number|string} userId - ID пользователя
   * @returns {Promise<WeeklyReport|null>} Последний отчет пользователя или null
   */
  async getLastReport(userId) {
    try {
      // Убеждаемся, что сервис инициализирован
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Функция для получения данных из API
      const fetchReports = async () => {
        return await errorHandler.withRetry(async () => {
          const response = await this.sheetsClient.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetNames.reports}!A2:I`
          });
          
          return response.data.values || [];
        });
      };
      
      // Получаем данные с использованием кэша
      const reports = await cacheManager.getOrSet(
        'all_reports', 
        fetchReports,
        300 // 5 минут
      );
      
      if (reports.length === 0) {
        return null;
      }
      
      // Ищем последний отчет пользователя (с конца)
      for (let i = reports.length - 1; i >= 0; i--) {
        const row = reports[i];
        if (row[2] == userId) { // Сравнение без строгой типизации, т.к. могут быть строки или числа
          return WeeklyReport.fromSheetRow(row);
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`Ошибка при получении последнего отчета: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Получает статистику пользователя
   * @param {number|string} userId - ID пользователя
   * @returns {Promise<UserStats>} Объект статистики пользователя
   */
  async getUserStats(userId) {
    try {
      // Убеждаемся, что сервис инициализирован
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Функция для получения данных из API
      const fetchReports = async () => {
        return await errorHandler.withRetry(async () => {
          const response = await this.sheetsClient.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetNames.reports}!A2:I`
          });
          
          return response.data.values || [];
        });
      };
      
      // Получаем данные с использованием кэша
      const reports = await cacheManager.getOrSet(
        'all_reports', 
        fetchReports,
        300 // 5 минут
      );
      
      // Создаем объект статистики
      return UserStats.fromReports(reports, userId);
    } catch (error) {
      logger.error(`Ошибка при получении статистики пользователя: ${error.message}`, error);
      return new UserStats(); // Возвращаем пустую статистику
    }
  }

  /**
   * Получает следующий номер недели для отчета
   * @returns {Promise<number>} Номер следующей недели
   */
  async getNextWeekNumber() {
    try {
      // Убеждаемся, что сервис инициализирован
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Функция для получения данных из API
      const fetchWeekNumbers = async () => {
        return await errorHandler.withRetry(async () => {
          const response = await this.sheetsClient.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetNames.reports}!A2:A`
          });
          
          return response.data.values || [];
        });
      };
      
      // Получаем данные с использованием кэша
      const weekNumbers = await cacheManager.getOrSet(
        'week_numbers', 
        fetchWeekNumbers,
        300 // 5 минут
      );
      
      if (weekNumbers.length === 0) {
        return 1; // Первая неделя
      }
      
      // Находим максимальный номер недели
      let maxWeek = 0;
      for (const row of weekNumbers) {
        if (row[0]) {
          const weekNum = parseInt(row[0]);
          if (!isNaN(weekNum) && weekNum > maxWeek) {
            maxWeek = weekNum;
          }
        }
      }
      
      return maxWeek + 1;
    } catch (error) {
      logger.error(`Ошибка при получении следующего номера недели: ${error.message}`, error);
      return 1; // По умолчанию возвращаем 1
    }
  }

  /**
   * Получает планы с предыдущей недели
   * @param {number} weekNumber - Текущий номер недели
   * @returns {Promise<Array<string>>} Массив планов или пустой массив
   */
  async getPreviousWeekPlans(weekNumber) {
    try {
      // Если это первая неделя, нет предыдущих планов
      if (weekNumber <= 1) {
        return [];
      }
      
      // Убеждаемся, что сервис инициализирован
      if (!this.initialized) {
        await this.initialize();
      }
      
      const previousWeek = weekNumber - 1;
      
      // Функция для получения данных из API
      const fetchReports = async () => {
        return await errorHandler.withRetry(async () => {
          const response = await this.sheetsClient.spreadsheets.values.get({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetNames.reports}!A2:H`
          });
          
          return response.data.values || [];
        });
      };
      
      // Получаем данные с использованием кэша
      const reports = await cacheManager.getOrSet(
        'all_reports', 
        fetchReports,
        300 // 5 минут
      );
      
      // Ищем отчет за предыдущую неделю
      for (const row of reports) {
        if (parseInt(row[0]) === previousWeek) {
          // Индекс 7 - планы на следующую неделю (A=0, B=1, ...)
          const plansData = row[7] || '[]';
          try {
            return JSON.parse(plansData);
          } catch (e) {
            logger.error(`Ошибка при парсинге планов предыдущей недели: ${e.message}`);
            return [];
          }
        }
      }
      
      return [];
    } catch (error) {
      logger.error(`Ошибка при получении планов предыдущей недели: ${error.message}`, error);
      return [];
    }
  }

  /**
   * Инвалидирует кэш для обновления данных
   * @returns {Promise<void>}
   */
  async invalidateCache() {
    await cacheManager.del('all_reports');
    await cacheManager.del('week_numbers');
    logger.debug('Кэш данных Google Sheets очищен');
  }
}

// Экспортируем одиночный экземпляр сервиса
module.exports = new SheetsService(); 